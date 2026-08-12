"""External-service client wrappers.

Thin, lazily-initialized adapters for the services this API depends on:

- ``embeddings.py`` — sentence-transformers (local embeddings)
- ``gemini.py``     — Gemini LLM (google-genai SDK)

Qdrant access will join this package when the retrieval layer is built. These
are infrastructure clients, distinct from ``app/tools/`` (agent-facing tools).
"""
