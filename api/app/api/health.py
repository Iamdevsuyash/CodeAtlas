"""Health check endpoint."""

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings

router = APIRouter(tags=["health"])

@router.get("/health")
def health(settings: Settings = Depends(get_settings)) -> dict:
    """Liveness/readiness probe. Returns basic service identity."""
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.environment,
    }
