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

## Repository ingestion

Start Qdrant locally before ingesting a repository:

```bash
docker run --rm -p 6333:6333 qdrant/qdrant
```

Then submit a git URL to `POST /api/ingest`:

```bash
curl -X POST http://localhost:8000/api/ingest \
  -H 'content-type: application/json' \
  -d '{"repo_url":"https://github.com/pallets/itsdangerous.git"}'
```

The response contains the repository-slug collection name, syntax-aware chunk
count, and total elapsed time. Source is parsed by tree-sitter into complete
function/class definitions; `.git`, dependency/virtualenv directories, binary
files, and files larger than 500 KB are excluded.

## Querying (agent)

Ask a question about an ingested repository. The agent runs a ReAct loop over
Gemini: it calls code-intelligence tools (`search_code`, `read_file`,
`list_directory`, `grep`) against the collection until it can answer, then cites
`file_path:line_number`.

```bash
curl -X POST http://localhost:8000/api/query \
  -H 'content-type: application/json' \
  -d '{"collection_name":"repo_itsdangerous","question":"Where is the URL-safe serializer defined?"}'
```

The response is `{answer, trace, iterations_used, stop_reason}`. `trace` is the
full observability record — every iteration's model reasoning, each tool call
with its arguments and result, and per-step timing (also emitted to the logger
as one line per iteration). The loop is capped at 8 tool-calling turns; on reaching
the cap it forces a final answer instead of looping forever. Requires
`GEMINI_API_KEY` (503 if unset) and an existing collection (404 if not ingested).

## Test


```bash
uv run pytest
```

The full clone → embed → Qdrant check uses a small public repository and is
opt-in (it requires Docker, network access, and the first model download):

```bash
CODEATLAS_RUN_INTEGRATION=1 uv run pytest tests/test_ingest_integration.py
```

The agent's end-to-end test runs offline by default — real chunking, embeddings,
and vector search against a fixture repo, with only Gemini faked. The live
variant (a real Gemini call) is opt-in:

```bash
GEMINI_API_KEY=... uv run pytest tests/test_agent_live.py
```

## Layout

```
app/
  main.py            # FastAPI app
  config.py          # pydantic-settings Settings + get_settings()
  chunker.py         # tree-sitter syntax-aware chunking
  pipeline.py        # clone -> chunk -> embed -> index
  qdrant_store.py    # Qdrant wrapper (upsert / search / scroll)
  api/               # HTTP endpoints
    health.py        # GET /health
    ingest.py        # POST /api/ingest
    query.py         # POST /api/query (runs the agent)
  clients/           # external-service clients
    embeddings.py    # sentence-transformers (local embeddings)
    gemini.py        # Gemini LLM (google-genai SDK)
  tools/             # search_code / read_file / list_directory / grep
  agent/             # ReAct loop over one repository
    loop.py          # run_agent(): the tool-calling cycle + trace
    prompts.py       # system prompt
tests/
```

## Models & keys

- **Embeddings** run locally via sentence-transformers (`all-MiniLM-L6-v2`,
  384-dim). The first embedding call downloads the model weights (~90 MB) to the
  Hugging Face cache — no API key needed.
- **Gemini** (LLM reasoning) needs `GEMINI_API_KEY` in `.env`. Without it the
  client raises a clear error and the live Gemini test is skipped.


## Future
- picked all-MiniLM-L6-v2 instead of the code-specific jina-embeddings-v2-base-code to get the  pipeline working end-to-end first.
