"""POST /api/query endpoint wiring. The agent and vector store are stubbed so
these assert HTTP behavior (status codes, response shape) without Gemini/Qdrant.
"""

from fastapi.testclient import TestClient

import app.api.query as query_module
from app.agent import AgentResult
from app.main import app

client = TestClient(app)


class _FakeStore:
    def __init__(self, *, exists: bool = True, boom: bool = False) -> None:
        if boom:
            raise ConnectionError("qdrant down")
        self._exists = exists

    def collection_exists(self, name: str) -> bool:
        return self._exists


def test_query_returns_answer_and_trace(monkeypatch):
    monkeypatch.setattr(query_module, "QdrantStore", lambda *a, **k: _FakeStore(exists=True))

    def fake_run_agent(question, collection_name, *, store, max_iterations):
        return AgentResult(
            answer="Login is in auth/routes.py:9",
            trace=[{"iteration": 1, "reasoning": "", "llm_ms": 1.0, "tool_calls": [], "final": True}],
            iterations_used=1,
            stop_reason="answered",
        )

    monkeypatch.setattr(query_module, "run_agent", fake_run_agent)

    resp = client.post("/api/query", json={"collection_name": "repo_x", "question": "where is login?"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["answer"].startswith("Login")
    assert body["iterations_used"] == 1
    assert body["stop_reason"] == "answered"
    assert body["trace"][0]["final"] is True


def test_query_404_when_collection_missing(monkeypatch):
    monkeypatch.setattr(query_module, "QdrantStore", lambda *a, **k: _FakeStore(exists=False))
    resp = client.post("/api/query", json={"collection_name": "nope", "question": "q"})
    assert resp.status_code == 404


def test_query_503_when_store_unavailable(monkeypatch):
    monkeypatch.setattr(query_module, "QdrantStore", lambda *a, **k: _FakeStore(boom=True))
    resp = client.post("/api/query", json={"collection_name": "x", "question": "q"})
    assert resp.status_code == 503


def test_query_503_when_gemini_key_missing(monkeypatch):
    monkeypatch.setattr(query_module, "QdrantStore", lambda *a, **k: _FakeStore(exists=True))

    def boom(*a, **k):
        raise RuntimeError("GEMINI_API_KEY is not set; cannot create Gemini client.")

    monkeypatch.setattr(query_module, "run_agent", boom)
    resp = client.post("/api/query", json={"collection_name": "x", "question": "q"})
    assert resp.status_code == 503
    assert "GEMINI_API_KEY" in resp.json()["detail"]


def test_query_502_on_upstream_error(monkeypatch):
    monkeypatch.setattr(query_module, "QdrantStore", lambda *a, **k: _FakeStore(exists=True))

    def boom(*a, **k):
        raise ValueError("model exploded")

    monkeypatch.setattr(query_module, "run_agent", boom)
    resp = client.post("/api/query", json={"collection_name": "x", "question": "q"})
    assert resp.status_code == 502


def test_query_validation_rejects_empty_fields():
    resp = client.post("/api/query", json={"collection_name": "", "question": ""})
    assert resp.status_code == 422
