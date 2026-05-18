"""Schemas for admin dashboard endpoints."""

from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.schemas.webhook import ALLOWED_COMMISSION_STATUSES


class AdminEmployee(BaseModel):
    """Employee record returned to admin clients."""

    id: str
    auth_user_id: str
    name: str
    email: str
    role: str
    active: bool


class AdminCommissionEmployee(BaseModel):
    """Employee details attached to commission rows."""

    id: str
    name: str
    email: str


class AdminCommission(BaseModel):
    """Commission row returned for admin listings."""

    id: str
    employee_id: str
    reason: str
    description: str | None
    revenue_amount: float
    commission_rate: float
    commission_amount: float
    status: str
    source: str
    source_url: str | None
    external_id: str | None
    created_at: str
    employee: AdminCommissionEmployee | None = None


class UpdateEmployeeRequest(BaseModel):
    """Payload for admin employee updates."""

    role: str | None = None
    active: bool | None = None

    model_config = ConfigDict(extra="forbid")


class UpdateCommissionStatusRequest(BaseModel):
    """Payload for commission status updates."""

    status: str = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ALLOWED_COMMISSION_STATUSES:
            allowed = ", ".join(ALLOWED_COMMISSION_STATUSES)
            raise ValueError(f"status must be one of: {allowed}")
        return normalized


class CommissionImportRowError(BaseModel):
    """Row-level CSV import validation error."""

    row_number: int
    message: str


class CommissionImportResponse(BaseModel):
    """Admin CSV import execution summary."""

    total_rows: int
    imported_count: int
    failed_count: int
    errors: list[CommissionImportRowError]
