"""Offline tests for key rotation - a fake HTTP session stands in for the Gemini API.

Run: python -m unittest discover -s tests
"""
import json
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor

from gemini_pool import GeminiError, GeminiPool


class FakeResponse:
    def __init__(self, status, body):
        self.status_code = status
        self._body = body
        self.ok = 200 <= status < 300
        self.text = json.dumps(body)

    def json(self):
        return self._body


def ok(text="hello", tokens=10):
    return FakeResponse(200, {"candidates": [{"content": {"parts": [{"text": text}]}}],
                              "usageMetadata": {"totalTokenCount": tokens}})


def err(status, status_name="", message="", details=None):
    return FakeResponse(status, {"error": {"code": status, "status": status_name,
                                           "message": message, "details": details or []}})


class FakeSession:
    """`script(key, model, call_no)` returns the FakeResponse for each POST."""

    def __init__(self, script):
        self.script = script
        self.calls = []
        self.lock = threading.Lock()

    def post(self, url, headers, json, timeout):
        model = url.rsplit("/", 1)[1].split(":")[0]
        with self.lock:
            self.calls.append((headers["x-goog-api-key"], model, json["generationConfig"]))
            n = len(self.calls)
        return self.script(headers["x-goog-api-key"], model, n)


class GeminiPoolTests(unittest.TestCase):
    def make(self, script, keys=("k1", "k2", "k3"), **kw):
        s = FakeSession(script)
        return GeminiPool(list(keys), models=["m-a", "m-b"], session=s, **kw), s

    def test_round_robin_spreads_load(self):
        pool, s = self.make(lambda k, m, n: ok())
        for i in range(6):
            pool.generate(f"p{i}")
        used = [c[0] for c in s.calls]
        self.assertEqual(used, ["k1", "k2", "k3", "k1", "k2", "k3"])

    def test_429_cools_key_and_fails_over(self):
        def script(k, m, n):
            if k == "k1":
                return err(429, "RESOURCE_EXHAUSTED", "quota", [
                    {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "30s"}])
            return ok()
        pool, s = self.make(script)
        text, meta = pool.generate("x")
        self.assertEqual(text, "hello")
        self.assertEqual(meta["key"], "#2")
        k1 = pool.status()["keys"][0]
        self.assertGreater(k1["cooling_down_s"], 25)
        # k1 is skipped while cooling down.
        for i in range(4):
            pool.generate(f"y{i}")
        self.assertNotIn("k1", [c[0] for c in s.calls[2:]])

    def test_daily_quota_cools_for_long(self):
        def script(k, m, n):
            if k == "k1":
                return err(429, "RESOURCE_EXHAUSTED", "daily", [
                    {"@type": "type.googleapis.com/google.rpc.QuotaFailure",
                     "violations": [{"quotaId": "GenerateRequestsPerDayPerProjectPerModel"}]}])
            return ok()
        pool, _ = self.make(script)
        pool.generate("x")
        self.assertGreater(pool.status()["keys"][0]["cooling_down_s"], 3000)

    def test_invalid_key_is_disabled(self):
        def script(k, m, n):
            if k == "k1":
                return err(400, "INVALID_ARGUMENT", "API key not valid. Please pass a valid API key.")
            return ok()
        pool, _ = self.make(script)
        pool.generate("x")
        self.assertTrue(pool.status()["keys"][0]["disabled"])

    def test_all_keys_invalid_raises(self):
        pool, _ = self.make(lambda k, m, n: err(401, "UNAUTHENTICATED", "bad key"))
        with self.assertRaises(GeminiError):
            pool.generate("x")

    def test_overloaded_model_falls_back_to_next_model(self):
        def script(k, m, n):
            return err(503, "UNAVAILABLE", "high demand") if m == "m-a" else ok("from b")
        pool, s = self.make(script)
        text, meta = pool.generate("x")
        self.assertEqual((text, meta["model"]), ("from b", "m-b"))
        # 503 is a model problem, not a key problem: no key is put on cooldown.
        self.assertTrue(all(k["cooling_down_s"] == 0 for k in pool.status()["keys"]))

    def test_cache_avoids_second_call(self):
        pool, s = self.make(lambda k, m, n: ok())
        pool.generate("same")
        _, meta = pool.generate("same")
        self.assertTrue(meta["cached"])
        self.assertEqual(len(s.calls), 1)

    def test_json_schema_and_thinking_config(self):
        pool, s = self.make(lambda k, m, n: ok('{"a": 1}'), thinking_level="minimal")
        result, _ = pool.generate("x", schema={"type": "OBJECT"})
        self.assertEqual(result, {"a": 1})
        cfg = s.calls[0][2]
        self.assertEqual(cfg["responseMimeType"], "application/json")
        self.assertEqual(cfg["thinkingConfig"], {"thinkingLevel": "minimal"})

    def test_bad_request_is_not_retried(self):
        pool, s = self.make(lambda k, m, n: err(400, "INVALID_ARGUMENT", "bad schema"))
        with self.assertRaises(GeminiError):
            pool.generate("x")
        self.assertEqual(len(s.calls), 1)

    def test_concurrent_requests_use_distinct_keys(self):
        barrier = threading.Barrier(3, timeout=5)

        def script(k, m, n):
            barrier.wait()  # all 3 requests in flight at once
            return ok()
        pool, s = self.make(script)
        with ThreadPoolExecutor(3) as ex:
            list(ex.map(lambda i: pool.generate(f"c{i}"), range(3)))
        self.assertEqual(sorted(c[0] for c in s.calls), ["k1", "k2", "k3"])

    def test_duplicate_and_blank_keys_ignored(self):
        pool = GeminiPool(["k1", " k1 ", "", "k2"], session=FakeSession(lambda *a: ok()))
        self.assertEqual(len(pool.status()["keys"]), 2)

    def test_from_env(self):
        pool = GeminiPool.from_env({"GEMINI_API_KEYS": "a,b", "GEMINI_API_KEY": "c",
                                    "GEMINI_MODELS": "x, y"})
        self.assertEqual(len(pool.status()["keys"]), 3)
        self.assertEqual(pool.models, ["x", "y"])

    def test_status_masks_keys(self):
        pool, _ = self.make(lambda *a: ok(), keys=("AQ.secretsecretABCD",))
        self.assertNotIn("secret", json.dumps(pool.status()))


if __name__ == "__main__":
    unittest.main()
