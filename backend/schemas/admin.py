"""Schemas for admin dashboard endpoints."""

from pydantic import BaseModel, ConfigDict, Field


class AdminEmployee(BaseModel):
    """Employee record returned to admin clients."""

    id: str
    auth_user_id: str
    name: str
    email: str
    role: str
    active: bool
    receive_email: bool


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
    receive_email: bool | None = None

    model_config = ConfigDict(extra="forbid")


class UpdateCommissionStatusRequest(BaseModel):
    """Payload for commission status updates."""

    status: str = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")


