"""Agent query API endpoint: ask a question about an ingested repository."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agent import run_agent
from app.agent.loop import DEFAULT_MAX_ITERATIONS
from app.qdrant_store import QdrantStore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["agent"])


class QueryRequest(BaseModel):
    collection_name: str = Field(min_length=1, description="Collection to reason over (from POST /api/ingest).")
    question: str = Field(min_length=1, description="Natural-language question about the repository.")
    max_iterations: int = Field(default=DEFAULT_MAX_ITERATIONS, ge=1, le=20, description="Hard cap on tool-calling turns.")


class ToolCall(BaseModel):
    name: str
    args: dict
    result: object
    result_summary: str
    tool_ms: float


class TraceEntry(BaseModel):
    iteration: int | None
    reasoning: str
    llm_ms: float
    tool_calls: list[ToolCall]
    final: bool
    forced: bool = False


class QueryResponse(BaseModel):
    answer: str
    trace: list[TraceEntry]
    iterations_used: int
    stop_reason: str


@router.post("/query", response_model=QueryResponse)
def query(request: QueryRequest) -> dict:
    try:
        store = QdrantStore()
        collection_exists = store.collection_exists(request.collection_name)
    except Exception as error:  # noqa: BLE001 - vector store is a hard dependency here
        logger.exception("Vector store unavailable for query")
        raise HTTPException(status_code=503, detail="Vector store unavailable.") from error

    if not collection_exists:
        raise HTTPException(
            status_code=404,
            detail=f"Collection '{request.collection_name}' not found. Ingest the repository first via POST /api/ingest.",
        )

    try:
        result = run_agent(request.question, request.collection_name, store=store, max_iterations=request.max_iterations)
    except RuntimeError as error:  # e.g. GEMINI_API_KEY not configured
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:  # noqa: BLE001 - upstream model/tool failure
        logger.exception("Agent run failed")
        raise HTTPException(status_code=502, detail="Agent run failed while contacting the model.") from error

    return result.to_dict()
