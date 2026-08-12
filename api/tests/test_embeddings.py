"""Smoke tests for the sentence-transformers embedding client.

These run locally with no API key. The first run downloads the model weights
(~90 MB) to the Hugging Face cache.
"""

from app.clients.embeddings import embed_text, embed_texts, embedding_dimension


def test_embedding_dimension_is_384():
    assert embedding_dimension() == 384


def test_embed_text_returns_float_vector():
    vector = embed_text("def add(a, b): return a + b")
    assert len(vector) == 384
    assert all(isinstance(x, float) for x in vector)


def test_embed_texts_batch_shape():
    vectors = embed_texts(["alpha", "beta", "gamma"])
    assert len(vectors) == 3
    assert all(len(v) == 384 for v in vectors)
