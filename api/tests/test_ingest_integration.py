"""Opt-in end-to-end verification against local Qdrant and a public repo.

Start Qdrant with the documented Docker command and set
``CODEATLAS_RUN_INTEGRATION=1`` to run this test. It intentionally uses a
small public repository, a real git clone, and the configured embedder.
"""

import os

import pytest

from app.clients.embeddings import embed_text
from app.pipeline import ingest_repository
from app.qdrant_store import QdrantStore


pytestmark = pytest.mark.skipif(
    os.getenv("CODEATLAS_RUN_INTEGRATION") != "1",
    reason="requires Docker Qdrant, network access, and the embedding model",
)


def test_ingest_public_repo_and_search():
    result = ingest_repository("https://github.com/pallets/itsdangerous.git")
    store = QdrantStore()

    collection = result["collection_name"]
    assert result["chunk_count"] > 0
    assert store.client.count(collection_name=collection, exact=True).count == result["chunk_count"]

    matches = store.search(collection, embed_text("URLSafeSerializer"), top_k=3)
    assert matches
    assert any("Serializer" in str(match.payload.get("content", "")) for match in matches)
