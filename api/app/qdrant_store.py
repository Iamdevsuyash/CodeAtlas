"""Small, payload-preserving wrapper around Qdrant for code chunks."""

from __future__ import annotations

from collections.abc import Iterator
from uuid import NAMESPACE_URL, uuid5

from qdrant_client import QdrantClient, models

from app.config import get_settings


class QdrantStore:
    def __init__(self, url: str | None = None, api_key: str | None = None, *, client: QdrantClient | None = None) -> None:
        if client is not None:  # injected client (e.g. QdrantClient(":memory:") in tests)
            self.client = client
            return
        settings = get_settings()
        self.client = QdrantClient(url=url or settings.qdrant_url, api_key=api_key if api_key is not None else settings.qdrant_api_key)

    def collection_exists(self, name: str) -> bool:
        return self.client.collection_exists(name)

    def create_collection(self, name: str, vector_size: int) -> None:
        """Create a cosine-distance collection when it does not already exist."""
        if not self.client.collection_exists(name):
            self.client.create_collection(collection_name=name, vectors_config=models.VectorParams(size=vector_size, distance=models.Distance.COSINE))

    def upsert_chunks(self, collection: str, chunks: list[dict[str, object]], embeddings: list[list[float]]) -> None:
        if len(chunks) != len(embeddings):
            raise ValueError("Each chunk must have exactly one embedding")
        points = [models.PointStruct(id=str(uuid5(NAMESPACE_URL, f"{collection}:{chunk['file_path']}:{chunk['start_line']}:{chunk['content']}")), vector=embedding, payload=chunk) for chunk, embedding in zip(chunks, embeddings, strict=True)]
        if points:
            self.client.upsert(collection_name=collection, points=points, wait=True)

    def search(self, collection: str, query_embedding: list[float], top_k: int):
        """Return Qdrant scored points, whose payload is the original chunk."""
        return self.client.query_points(collection_name=collection, query=query_embedding, limit=top_k, with_payload=True).points

    def scroll_all(self, collection: str, *, page_size: int = 256) -> Iterator[dict[str, object]]:
        """Yield every chunk payload in a collection (paged; no vectors fetched).

        Backs the non-semantic tools (read_file / list_directory / grep), which
        enumerate the indexed corpus rather than doing vector search.
        """
        offset = None
        while True:
            points, offset = self.client.scroll(collection_name=collection, limit=page_size, offset=offset, with_payload=True, with_vectors=False)
            for point in points:
                if point.payload is not None:
                    yield point.payload
            if offset is None:
                break
