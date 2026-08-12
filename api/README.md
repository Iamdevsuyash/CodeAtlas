# CodeAtlas API

FastAPI service for the agentic rewrite of CodeAtlas. Hosts code-intelligence
tools (`search_code`, `read_file`, ...) backed by [Qdrant](https://qdrant.tech/)
for vector search and [tree-sitter](https://tree-sitter.github.io/) for parsing.

This is a standalone [uv](https://docs.astral.sh/uv/) project (Python 3.12),
fully isolated from the legacy Flask backend (`../backend1.py`), which remains
runnable for demos.

## Setup

```bash
uv sync                      # create .venv and install deps from uv.lock
cp .env.example .env         # optional; defaults work for local dev
```

## Run

```bash
uv run uvicorn app.main:app --reload --port 8000
```

- Health check: <http://localhost:8000/health>
- Swagger UI:   <http://localhost:8000/docs>

## Test

```bash
uv run pytest
```

## Layout

```
app/
  main.py            # FastAPI app
  config.py          # pydantic-settings Settings + get_settings()
  api/health.py      # GET /health
  clients/           # external-service clients
    embeddings.py    # sentence-transformers (local embeddings)
    gemini.py        # Gemini LLM (google-genai SDK)
  tools/             # home for search_code / read_file / ...
tests/
```

## Models & keys

- **Embeddings** run locally via sentence-transformers (`all-MiniLM-L6-v2`,
  384-dim). The first embedding call downloads the model weights (~90 MB) to the
  Hugging Face cache — no API key needed.
- **Gemini** (LLM reasoning) needs `GEMINI_API_KEY` in `.env`. Without it the
  client raises a clear error and the live Gemini test is skipped.
