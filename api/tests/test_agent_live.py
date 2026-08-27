"""Opt-in end-to-end run against the REAL Gemini API.

Skipped unless GEMINI_API_KEY is set in the environment (and network is
available). Uses the real chunk -> embed -> Qdrant pipeline (real_indexed_store)
plus a real Gemini client: the first true end-to-end test of the whole stack.

    GEMINI_API_KEY=... uv run pytest tests/test_agent_live.py
"""

import os

import pytest

from app.agent import run_agent

pytestmark = pytest.mark.skipif(not os.getenv("GEMINI_API_KEY"), reason="requires GEMINI_API_KEY + network")


def test_agent_answers_login_question_live(real_indexed_store):
    store, collection, _chunks = real_indexed_store

    result = run_agent(
        "Where is the login route defined? Cite the file and line.",
        collection,
        store=store,
    )

    assert result.answer.strip()
    assert result.iterations_used >= 1
    # Grounded in the correct file, and the agent actually searched to get there.
    assert "auth/routes.py" in result.answer
    used_search = any(call["name"] == "search_code" for entry in result.trace for call in entry["tool_calls"])
    assert used_search
