"""Repository-ingestion API endpoint."""

import subprocess

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.pipeline import ingest_repository


router = APIRouter(prefix="/api", tags=["ingestion"])


class IngestRequest(BaseModel):
    repo_url: str = Field(min_length=1, description="Git URL of the repository to index")


class IngestResponse(BaseModel):
    collection_name: str
    chunk_count: int
    elapsed_seconds: float


@router.post("/ingest", response_model=IngestResponse)
def ingest(request: IngestRequest) -> dict[str, object]:
    try:
        return ingest_repository(request.repo_url)
    except subprocess.CalledProcessError as error:
        raise HTTPException(status_code=422, detail=f"Unable to clone repository: {error.stderr}") from error
