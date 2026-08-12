"""Application configuration loaded from the environment / a local .env file.

Settings for the code-intelligence stack: Qdrant (vector store),
sentence-transformers (local embeddings), and Gemini (LLM reasoning, via the
google-genai SDK). Extend the Settings class below as new services are wired in.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App metadata
    app_name: str = "CodeAtlas API"
    environment: str = "development"
    debug: bool = True

    # Qdrant (vector store)
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None

    # Embeddings (sentence-transformers, local/free)
    embedding_model: str = "all-MiniLM-L6-v2"  # 384-dim, CPU-friendly

    # Gemini (LLM reasoning, google-genai SDK)
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3-flash-preview"  # matches legacy backend1.py; override via GEMINI_MODEL


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (read the environment only once)."""
    return Settings()
