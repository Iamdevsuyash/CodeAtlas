"""Local text embeddings via sentence-transformers.

Wraps a single SentenceTransformer model (see ``Settings.embedding_model``,
default ``all-MiniLM-L6-v2`` -> 384 dims). The model is loaded lazily and cached
for the process; the first call downloads the weights (~90 MB) to the Hugging
Face cache. Vectors are L2-normalized so cosine similarity equals the dot
product for the future Qdrant layer.
"""

from functools import lru_cache

from sentence_transformers import SentenceTransformer

from app.config import get_settings


@lru_cache
def get_embedder() -> SentenceTransformer:
    """Return the process-wide SentenceTransformer, loading it on first use."""
    return SentenceTransformer(get_settings().embedding_model)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts into normalized float vectors."""
    vectors = get_embedder().encode(texts, normalize_embeddings=True)
    return [vector.tolist() for vector in vectors]


def embed_text(text: str) -> list[float]:
    """Embed a single text into a normalized float vector."""
    return embed_texts([text])[0]


def embedding_dimension() -> int:
    """Vector size produced by the configured model (e.g. 384 for MiniLM)."""
    return get_embedder().get_embedding_dimension()
