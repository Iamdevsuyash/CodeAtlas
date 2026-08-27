"""Repository ingestion: clone, parse, embed, and index source code."""

from __future__ import annotations

import logging
import re
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.parse import urlparse

from app.chunker import chunk_repository
from app.clients.embeddings import embed_texts, embedding_dimension
from app.qdrant_store import QdrantStore


logger = logging.getLogger(__name__)


def collection_name_for_repo(repo_url: str) -> str:
    """Build a stable, Qdrant-safe collection name from a repository URL."""
    path = urlparse(repo_url).path.rstrip("/")
    slug = path.rsplit("/", 1)[-1].removesuffix(".git") or "repository"
    return f"repo_{re.sub(r'[^a-zA-Z0-9_-]+', '-', slug).strip('-_').lower() or 'repository'}"


def ingest_repository(repo_url: str, store: QdrantStore | None = None) -> dict[str, object]:
    """Clone and index a repository, returning API-safe ingestion metadata."""
    started = time.monotonic()
    collection = collection_name_for_repo(repo_url)
    with tempfile.TemporaryDirectory(prefix="codeatlas-") as temporary_directory:
        clone_path = Path(temporary_directory) / "repository"
        stage_started = time.monotonic()
        subprocess.run(["git", "clone", "--depth", "1", repo_url, str(clone_path)], check=True, capture_output=True, text=True)
        logger.info("Cloned %s in %.2fs", repo_url, time.monotonic() - stage_started)
        stage_started = time.monotonic()
        chunks = chunk_repository(clone_path)
        logger.info("Chunked %d definitions in %.2fs", len(chunks), time.monotonic() - stage_started)
        stage_started = time.monotonic()
        embeddings = embed_texts([str(chunk["content"]) for chunk in chunks]) if chunks else []
        logger.info("Embedded %d chunks in %.2fs", len(chunks), time.monotonic() - stage_started)
        stage_started = time.monotonic()
        qdrant = store or QdrantStore()
        qdrant.create_collection(collection, embedding_dimension())
        qdrant.upsert_chunks(collection, chunks, embeddings)
        logger.info("Upserted %d chunks in %.2fs", len(chunks), time.monotonic() - stage_started)
    elapsed = time.monotonic() - started
    logger.info("Finished ingestion of %s: %d chunks in %.2fs", repo_url, len(chunks), elapsed)
    return {"collection_name": collection, "chunk_count": len(chunks), "elapsed_seconds": elapsed}
