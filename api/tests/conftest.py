"""Shared pytest fixtures and offline configuration for the test suite.

If the sentence-transformers model is already cached locally, force Hugging Face
into offline mode so embedding tests never touch the network (fast + hermetic).
When the model is *not* cached (e.g. a fresh CI machine), we leave networking on
so the first run can download it — matching the behavior the other tests expect.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from app.qdrant_store import QdrantStore


def _embedding_model_cached() -> bool:
    hub = Path(os.getenv("HF_HOME", str(Path.home() / ".cache" / "huggingface"))) / "hub"
    return hub.exists() and any(hub.glob("*all-MiniLM-L6-v2*"))


if _embedding_model_cached():
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")


@pytest.fixture(scope="session")
def sample_repo_path() -> Path:
    return Path(__file__).parent / "fixtures" / "sample_repo"


@pytest.fixture
def in_memory_store():
    """Factory: build an in-memory QdrantStore seeded with the given chunks.

    Uses fake fixed-size vectors — fine for the scroll-based tools (read_file,
    list_directory, grep), which never do vector search.
    """
    from qdrant_client import QdrantClient

    def _make(chunks: list[dict], *, dim: int = 8, collection: str = "test") -> tuple[QdrantStore, str]:
        store = QdrantStore(client=QdrantClient(":memory:"))
        store.create_collection(collection, dim)
        store.upsert_chunks(collection, chunks, [[0.1] * dim for _ in chunks])
        return store, collection

    return _make


@pytest.fixture(scope="session")
def real_indexed_store(sample_repo_path):
    """The fixture repo indexed with REAL embeddings into an in-memory Qdrant.

    This is the genuine chunk -> embed -> vector-store pipeline; only Gemini is
    ever faked on top of it. Skips if the embedding model can't load offline.
    """
    from qdrant_client import QdrantClient

    from app.chunker import chunk_repository
    from app.clients.embeddings import embed_texts, embedding_dimension

    chunks = chunk_repository(sample_repo_path)
    try:
        embeddings = embed_texts([str(chunk["content"]) for chunk in chunks])
        dimension = embedding_dimension()
    except Exception as error:  # noqa: BLE001 - offline without cached weights
        pytest.skip(f"embedding model unavailable: {error}")

    store = QdrantStore(client=QdrantClient(":memory:"))
    collection = "sample_repo"
    store.create_collection(collection, dimension)
    store.upsert_chunks(collection, chunks, embeddings)
    return store, collection, chunks
