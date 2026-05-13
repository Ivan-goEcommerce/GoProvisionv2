"""Shared API response schemas."""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health endpoint response."""

    status: str = "ok"
    service: str
    environment: str
    version: str


class ErrorResponse(BaseModel):
    """Standard error payload."""

    error: str
    message: str
    request_id: str = Field(description="Correlates app logs with this response.")
