"""Webhook endpoints."""

import hmac
from typing import Annotated

from fastapi import APIRouter, Header

from backend.core.config import settings
from backend.core.errors import AppError
from backend.schemas.webhook import CommissionWebhookRequest, CommissionWebhookResponse
from backend.services.commission_service import CommissionService
from backend.services.supabase_client import get_service_supabase

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _validate_webhook_auth(authorization_header: str | None) -> None:
    if not authorization_header:
        raise AppError(
            error="unauthorized",
            message="Missing Authorization header.",
            status_code=401,
        )

    expected = f"Bearer {settings.webhook_secret}"
    if not hmac.compare_digest(authorization_header, expected):
        raise AppError(
            error="unauthorized",
            message="Invalid webhook token.",
            status_code=401,
        )


@router.post("/commissions", response_model=CommissionWebhookResponse, status_code=201)
def create_commissions_webhook(
    payload: CommissionWebhookRequest,
    authorization: Annotated[str | None, Header()] = None,
) -> CommissionWebhookResponse:
    """Create commission rows from external webhook payload."""
    _validate_webhook_auth(authorization)

    service = CommissionService(get_service_supabase())
    inserted = service.create_commissions_from_webhook(payload)
    return CommissionWebhookResponse(commissions=inserted)
