"""Health check endpoint."""

from fastapi import APIRouter

from backend.core.config import settings
from backend.schemas.common import HealthResponse

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthResponse)
def health() -> HealthResponse:
    """Return basic service health metadata."""
    return HealthResponse(
        service=settings.app_name,
        environment=settings.app_env,
        version=settings.app_version,
    )
