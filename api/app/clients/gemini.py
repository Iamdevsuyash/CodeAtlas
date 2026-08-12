"""Gemini LLM client (google-genai SDK).

Thin wrapper over ``google.genai.Client`` for text generation. The client is
created lazily and cached; a missing ``GEMINI_API_KEY`` raises a clear error at
call time rather than at import. Tool/function-calling for the agent loop will
be layered on top of this later.
"""

from functools import lru_cache

from google import genai

from app.config import get_settings


@lru_cache
def get_gemini_client() -> genai.Client:
    """Return a cached google-genai Client, or raise if no API key is set."""
    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not set; cannot create Gemini client.")
    return genai.Client(api_key=settings.gemini_api_key)


def generate(prompt: str, *, model: str | None = None) -> str:
    """Generate text for a single prompt, returning the response text."""
    settings = get_settings()
    response = get_gemini_client().models.generate_content(
        model=model or settings.gemini_model,
        contents=prompt,
    )
    return response.text or ""
