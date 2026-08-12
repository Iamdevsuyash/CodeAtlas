"""FastAPI application entrypoint for the CodeAtlas API (agentic rewrite)."""

from fastapi import FastAPI

from app.api.health import router as health_router
from app.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name, debug=settings.debug)
app.include_router(health_router)
