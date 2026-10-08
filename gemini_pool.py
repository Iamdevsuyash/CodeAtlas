"""
Gemini client with multi-key rotation, model fallback and response caching.

Keys come from GEMINI_API_KEYS (comma-separated) and/or GEMINI_API_KEY.
Never hardcode keys here - this file is committed.

Algorithm
---------
* Key selection: among keys that are not cooling down / disabled, pick the one
  with the fewest in-flight requests, breaking ties by least-recently-used.
  This spreads load evenly (round-robin under light load, least-loaded under
  concurrency) so no single key hits its RPM limit first.
* 429 RESOURCE_EXHAUSTED: the key is put on cooldown for the server-provided
  RetryInfo delay (or exponential backoff), then the request is retried
  immediately on the next healthy key. Daily-quota violations cool the key for
  much longer so we stop hammering it.
* 401/403 or "API key not valid": the key is disabled for the process lifetime.
* 500/503/504 (model overloaded): not the key's fault, so we fall through to the
  next model in GEMINI_MODELS after a short backoff.
* Identical prompts are served from an in-memory TTL cache (no tokens spent).

Note: Gemini quotas are enforced per Google Cloud *project*. Rotation only
multiplies throughput when keys belong to different projects; with keys from
one project it still gives failover for invalid/disabled keys.
"""
import hashlib
import json
import random
import re
import threading
import time
from collections import OrderedDict

import requests

API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
DEFAULT_MODELS = ["gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-flash-latest"]


class GeminiError(Exception):
    pass


class _KeyState:
    def __init__(self, key, index):
        self.key = key
        self.index = index
        self.cooldown_until = 0.0
        self.disabled = False
        self.in_flight = 0
        self.last_used = 0
        self.strikes = 0  # consecutive 429s, drives exponential backoff
        self.requests = 0
        self.failures = 0
        self.tokens = 0

    def public(self, now):
        return {
            "key": f"#{self.index + 1} …{self.key[-4:]}",
            "disabled": self.disabled,
            "cooling_down_s": max(0, round(self.cooldown_until - now, 1)),
            "in_flight": self.in_flight,
            "requests": self.requests,
            "failures": self.failures,
            "tokens": self.tokens,
        }


class TTLCache:
    def __init__(self, max_items=256, ttl=6 * 3600):
        self.max_items, self.ttl = max_items, ttl
        self._data = OrderedDict()
        self._lock = threading.Lock()

    def get(self, k):
        with self._lock:
            item = self._data.get(k)
            if not item:
                return None
            if item[0] < time.time():
                del self._data[k]
                return None
            self._data.move_to_end(k)
            return item[1]

    def set(self, k, v):
        with self._lock:
            self._data[k] = (time.time() + self.ttl, v)
            self._data.move_to_end(k)
            while len(self._data) > self.max_items:
                self._data.popitem(last=False)


def _parse_retry_delay(error):
    """Seconds from google.rpc.RetryInfo, and whether a per-day quota was hit."""
    delay, daily = None, False
    for d in error.get("details", []) or []:
        t = d.get("@type", "")
        if t.endswith("RetryInfo"):
            m = re.match(r"([\d.]+)s", str(d.get("retryDelay", "")))
            if m:
                delay = float(m.group(1))
        elif t.endswith("QuotaFailure"):
            for v in d.get("violations", []) or []:
                if "PerDay" in str(v.get("quotaId", "")):
                    daily = True
    return delay, daily


class GeminiPool:
    def __init__(self, keys, models=None, thinking_level="minimal", timeout=120,
                 max_attempts=None, session=None):
        uniq = list(dict.fromkeys(k.strip() for k in keys if k and k.strip()))
        self._keys = [_KeyState(k, i) for i, k in enumerate(uniq)]
        self.models = models or list(DEFAULT_MODELS)
        self.thinking_level = thinking_level
        self.timeout = timeout
        self.max_attempts = max_attempts or max(4, len(self._keys) * len(self.models))
        self._lock = threading.Lock()
        self._ticket = 0  # monotonic LRU counter; wall-clock ties on Windows (~15ms)
        self._cache = TTLCache()
        self._http = session or requests.Session()
        self.cache_hits = 0

    @classmethod
    def from_env(cls, env):
        keys = (env.get("GEMINI_API_KEYS") or "").split(",") + [env.get("GEMINI_API_KEY") or ""]
        models = [m.strip() for m in (env.get("GEMINI_MODELS") or "").split(",") if m.strip()]
        return cls(keys, models=models or None,
                   thinking_level=env.get("GEMINI_THINKING_LEVEL", "minimal") or None)

    @property
    def configured(self):
        return bool(self._keys)

    # --- key selection -------------------------------------------------
    def _acquire(self):
        """Return (key_state, wait_seconds). key_state is None if all disabled."""
        with self._lock:
            now = time.time()
            live = [k for k in self._keys if not k.disabled]
            if not live:
                return None, 0
            ready = [k for k in live if k.cooldown_until <= now]
            if not ready:
                soonest = min(live, key=lambda k: k.cooldown_until)
                return soonest, soonest.cooldown_until - now
            best = min(ready, key=lambda k: (k.in_flight, k.last_used))
            best.in_flight += 1
            self._ticket += 1
            best.last_used = self._ticket
            best.requests += 1
            return best, 0

    def _release(self, ks, ok, tokens=0, cooldown=None, disable=False):
        with self._lock:
            ks.in_flight = max(0, ks.in_flight - 1)
            ks.tokens += tokens
            if ok:
                ks.strikes = 0
                return
            ks.failures += 1
            if disable:
                ks.disabled = True
            if cooldown:
                ks.cooldown_until = max(ks.cooldown_until, time.time() + cooldown)

    # --- request ---------------------------------------------------------
    def _body(self, model, prompt, schema, max_output_tokens, temperature):
        cfg = {"maxOutputTokens": max_output_tokens}
        if temperature is not None:
            cfg["temperature"] = temperature
        if schema:
            cfg["responseMimeType"] = "application/json"
            cfg["responseSchema"] = schema
        # Thinking tokens are billed as output; "minimal" saves ~80% on
        # summarisation-style prompts. Only Gemini 3+ / "-latest" accept levels.
        if self.thinking_level and not model.startswith("gemini-2"):
            cfg["thinkingConfig"] = {"thinkingLevel": self.thinking_level}
        return {"contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": cfg}

    def generate(self, prompt, schema=None, max_output_tokens=4096, temperature=None,
                 use_cache=True, deadline_s=150):
        """Return (text_or_parsed_json, meta). Raises GeminiError on failure."""
        if not self._keys:
            raise GeminiError("No Gemini API keys configured (set GEMINI_API_KEYS).")
        cache_key = hashlib.sha256(json.dumps([prompt, schema, max_output_tokens]).encode()).hexdigest()
        if use_cache:
            hit = self._cache.get(cache_key)
            if hit is not None:
                self.cache_hits += 1
                return hit, {"cached": True}

        started = time.time()
        model_idx, attempt, last_err = 0, 0, "unknown error"
        while attempt < self.max_attempts and model_idx < len(self.models):
            if time.time() - started > deadline_s:
                break
            ks, wait = self._acquire()
            if ks is None:
                raise GeminiError("All Gemini API keys were rejected as invalid.")
            if wait > 0:
                if wait > 20 or time.time() + wait - started > deadline_s:
                    raise GeminiError(f"All Gemini API keys are rate-limited; retry in {int(wait) + 1}s.")
                time.sleep(wait)
                continue
            attempt += 1
            model = self.models[model_idx]
            try:
                r = self._http.post(f"{API_BASE}/{model}:generateContent",
                                    headers={"x-goog-api-key": ks.key},
                                    json=self._body(model, prompt, schema, max_output_tokens, temperature),
                                    timeout=self.timeout)
            except requests.RequestException as e:
                self._release(ks, ok=False)
                last_err = f"network error: {e}"
                time.sleep(min(8, 2 ** attempt * 0.25))
                continue

            if r.ok:
                data = r.json()
                usage = data.get("usageMetadata", {})
                self._release(ks, ok=True, tokens=usage.get("totalTokenCount", 0))
                text = self._extract_text(data)
                if text is None:
                    last_err = f"empty response ({data.get('promptFeedback') or 'no candidates'})"
                    model_idx += 1
                    continue
                result = text
                if schema:
                    try:
                        result = json.loads(text)
                    except ValueError:
                        # Truncated JSON (hit maxOutputTokens) - retry on another model.
                        last_err = "model returned malformed JSON"
                        model_idx += 1
                        continue
                if use_cache:
                    self._cache.set(cache_key, result)
                return result, {"cached": False, "model": model, "key": f"#{ks.index + 1}",
                                "usage": usage, "attempts": attempt}

            try:
                err = r.json().get("error", {})
            except ValueError:
                err = {}
            msg = err.get("message") or r.text[:200]
            status = err.get("status", "")
            last_err = f"{r.status_code} {status}: {msg}"

            if r.status_code == 429:
                with self._lock:
                    ks.strikes += 1
                    strikes = ks.strikes
                delay, daily = _parse_retry_delay(err)
                cool = 3600 if daily else (delay or min(60, 2 ** strikes)) + random.uniform(0, 1)
                self._release(ks, ok=False, cooldown=cool)
            elif r.status_code in (401, 403) or "API key not valid" in msg or "API_KEY_INVALID" in json.dumps(err):
                self._release(ks, ok=False, disable=True)
            elif r.status_code == 404:
                # Model not available to this key/project - try the next model.
                self._release(ks, ok=False)
                model_idx += 1
            elif r.status_code in (500, 502, 503, 504):
                self._release(ks, ok=False)
                model_idx += 1
                time.sleep(random.uniform(0.3, 1.0))
            else:
                # 400 bad request etc. - retrying with another key won't help.
                self._release(ks, ok=False)
                raise GeminiError(last_err)
        raise GeminiError(f"Gemini request failed after {attempt} attempts: {last_err}")

    @staticmethod
    def _extract_text(data):
        for cand in data.get("candidates", []) or []:
            parts = (cand.get("content") or {}).get("parts") or []
            text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
            if text.strip():
                return text
        return None

    def status(self):
        now = time.time()
        with self._lock:
            return {
                "models": self.models,
                "thinking_level": self.thinking_level,
                "cache_hits": self.cache_hits,
                "keys": [k.public(now) for k in self._keys],
            }
