"""Business logic for admin dashboard data."""

from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from backend.core.errors import AppError


class AdminService:
    """Loads and updates admin-managed resources."""

    def __init__(self, supabase_client: Client) -> None:
        self.supabase = supabase_client

    def list_commissions(self, limit: int = 500) -> list[dict]:
        """Return latest commissions with employee relation."""
        response = (
            self.supabase.table("commissions")
            .select(
                "id, employee_id, reason, description, revenue_amount, "
                "commission_rate, commission_amount, status, source, source_url, "
                "external_id, created_at, employee:employees(id,name,email)"
            )
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = response.data or []
        return [self._normalize_commission_row(row) for row in rows]

    def list_employees(self, limit: int = 500) -> list[dict]:
        """Return active employee catalog for admin panel."""
        response = (
            self.supabase.table("employees")
            .select("id, auth_user_id, name, email, role, active, receive_email")
            .order("name", desc=False)
            .limit(limit)
            .execute()
        )
        return response.data or []

    def update_employee(
        self, employee_id: str, role: str | None, active: bool | None, receive_email: bool | None = None
    ) -> dict:
        """Update mutable employee fields and return updated row."""
        updates: dict[str, str | bool] = {}
        if role is not None:
            updates["role"] = role
        if active is not None:
            updates["active"] = active
        if receive_email is not None:
            updates["receive_email"] = receive_email
        if not updates:
            raise AppError(
                error="validation_error",
                message="At least one field (role, active, or receive_email) must be provided.",
                status_code=422,
            )

        response = (
            self.supabase.table("employees")
            .update(updates)
            .eq("id", employee_id)
            .select("id, auth_user_id, name, email, role, active, receive_email")
            .execute()
        )
        rows = response.data or []
        if not rows:
            raise AppError(
                error="not_found",
                message="Employee not found.",
                status_code=404,
            )
        return rows[0]

    def update_commission_status(self, commission_id: str, status: str) -> dict:
        """Update commission status and return updated row."""
        updates: dict[str, str | None] = {"status": status}
        updates["paid_at"] = (
            datetime.now(UTC).isoformat() if status == "paid" else None
        )

        response = (
            self.supabase.table("commissions")
            .update(updates)
            .eq("id", commission_id)
            .select(
                "id, employee_id, reason, description, revenue_amount, "
                "commission_rate, commission_amount, status, source, source_url, "
                "external_id, created_at, employee:employees(id,name,email)"
            )
            .execute()
        )
        rows = response.data or []
        if not rows:
            raise AppError(
                error="not_found",
                message="Commission not found.",
                status_code=404,
            )
        return self._normalize_commission_row(rows[0])

    @staticmethod
    def _normalize_commission_row(row: dict) -> dict:
        employee_relation = row.get("employee")
        employee = (
            employee_relation[0]
            if isinstance(employee_relation, list) and employee_relation
            else employee_relation
        )
        normalized = dict(row)
        normalized["employee"] = employee
        return normalized
