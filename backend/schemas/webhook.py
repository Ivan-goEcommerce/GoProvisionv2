"""Schemas for commission webhook payloads."""

from decimal import Decimal

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, EmailStr, Field, field_validator

ALLOWED_COMMISSION_STATUSES = ("offen", "in_bearbeitung", "bezahlt", "storniert")


class ParticipantInput(BaseModel):
    """Single participant in webhook payload."""

    email: EmailStr
    commission_rate: Decimal = Field(gt=0, description="Rate as decimal, e.g. 0.05")

    model_config = ConfigDict(extra="forbid")


class CommissionWebhookRequest(BaseModel):
    """Incoming webhook payload from external systems."""

    revenue: Decimal = Field(gt=0)
    reason: str = Field(min_length=1)
    description: str | None = None
    source_url: AnyHttpUrl | None = None
    status: str = Field(default="offen")
    external_id: str | None = None
    participants: list[ParticipantInput] = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")

    @field_validator("status")
    @classmethod
    def normalize_status(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("external_id")
    @classmethod
    def normalize_external_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class CommissionCreated(BaseModel):
    """Commission record returned to webhook caller."""

    id: str
    employee_id: str
    revenue_amount: Decimal
    commission_rate: Decimal
    commission_amount: Decimal
    reason: str
    description: str | None
    source_url: str | None
    status: str
    source: str
    external_id: str | None


class CommissionWebhookResponse(BaseModel):
    """Webhook success response."""

    success: bool = True
    commissions: list[CommissionCreated]
