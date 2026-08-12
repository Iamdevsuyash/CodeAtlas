"""Smoke tests for the Gemini client.

The missing-key test runs offline. The live generation test is skipped unless
``GEMINI_API_KEY`` is set in the environment.
"""

import os
from types import SimpleNamespace

import pytest

from app.clients import gemini


def test_missing_key_raises(monkeypatch):
    monkeypatch.setattr(
        gemini,
        "get_settings",
        lambda: SimpleNamespace(gemini_api_key=None, gemini_model="gemini-3-flash-preview"),
    )
    gemini.get_gemini_client.cache_clear()
    try:
        with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
            gemini.get_gemini_client()
    finally:
        gemini.get_gemini_client.cache_clear()


@pytest.mark.skipif(not os.getenv("GEMINI_API_KEY"), reason="requires GEMINI_API_KEY")
def test_generate_live():
    output = gemini.generate("Reply with the single word: pong")
    assert isinstance(output, str)
    assert output.strip()
