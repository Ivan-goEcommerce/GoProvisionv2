"""Business logic for commission creation via webhook."""

from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from postgrest.exceptions import APIError as PostgrestApiError
from supabase import Client

from backend.core.errors import AppError
from backend.schemas.webhook import CommissionWebhookRequest

MONEY_DECIMALS = Decimal("0.01")


class CommissionService:
    """Coordinates validation and commission inserts."""

    def __init__(self, supabase_client: Client) -> None:
        self.supabase = supabase_client

    def create_commissions_from_webhook(
        self, payload: CommissionWebhookRequest
    ) -> list[dict]:
        """Create one commission row per participant."""
        participants = payload.participants
        normalized_emails = [participant.email.lower() for participant in participants]

        employees_response = (
            self.supabase.table("employees")
            .select("id,email,active")
            .in_("email", normalized_emails)
            .execute()
        )
        employees = employees_response.data or []
        employee_map = {
            str(employee["email"]).lower(): employee for employee in employees
        }

        for email in normalized_emails:
            employee = employee_map.get(email)
            if not employee:
                raise AppError(
                    error="employee_not_found",
                    message=f"Employee not found: {email}",
                    status_code=400,
                )
            if not employee.get("active"):
                raise AppError(
                    error="employee_inactive",
                    message=f"Employee is inactive: {email}",
                    status_code=400,
                )

        commission_rows = []
        provided_external_id = payload.external_id.strip() if payload.external_id else None
        for participant in participants:
            email = participant.email.lower()
            employee = employee_map[email]
            commission_amount = (payload.revenue * participant.commission_rate).quantize(
                MONEY_DECIMALS, rounding=ROUND_HALF_UP
            )
            description = payload.description or payload.reason
            source_url = str(payload.source_url) if payload.source_url else None
            resolved_external_id = provided_external_id or f"wh_{uuid4().hex}"

            commission_rows.append(
                {
                    "employee_id": employee["id"],
                    "revenue_amount": float(payload.revenue),
                    "commission_rate": float(participant.commission_rate),
                    "commission_amount": float(commission_amount),
                    "reason": payload.reason,
                    "description": description,
                    "source_url": source_url,
                    "external_id": resolved_external_id,
                    "status": payload.status,
                    "source": "webhook",
                }
            )

        try:
            insert_response = (
                self.supabase.table("commissions")
                .insert(commission_rows, returning="representation")
                .execute()
            )
        except PostgrestApiError as error:
            if error.code == "23505":
                raise AppError(
                    error="external_id_conflict",
                    message="Duplicate external_id. This webhook may already be processed.",
                    status_code=409,
                ) from error
            raise

        return insert_response.data or []
