"""Admin-only operational endpoints."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Header
from fastapi.responses import Response

from backend.core.errors import AppError
from backend.schemas.admin import AdminCommission, AdminEmployee, UpdateEmployeeRequest
from backend.services.admin_export_service import AdminExportService
from backend.services.admin_service import AdminService
from backend.services.supabase_client import get_service_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


def _extract_bearer_token(authorization_header: str | None) -> str:
    if not authorization_header:
        raise AppError(
            error="unauthorized",
            message="Missing Authorization header.",
            status_code=401,
        )

    prefix = "Bearer "
    if not authorization_header.startswith(prefix):
        raise AppError(
            error="unauthorized",
            message="Authorization header must use Bearer token.",
            status_code=401,
        )
    token = authorization_header[len(prefix) :].strip()
    if not token:
        raise AppError(
            error="unauthorized",
            message="Bearer token is empty.",
            status_code=401,
        )
    return token


def _require_admin_actor(authorization_header: str | None) -> dict:
    token = _extract_bearer_token(authorization_header)
    supabase = get_service_supabase()

    auth_user = supabase.auth.get_user(token).user
    if not auth_user:
        raise AppError(
            error="unauthorized",
            message="Invalid access token.",
            status_code=401,
        )

    profile_response = (
        supabase.table("employees")
        .select("id, auth_user_id, email, name, role, active")
        .eq("auth_user_id", str(auth_user.id))
        .single()
        .execute()
    )
    profile = profile_response.data
    if not profile or not profile.get("active") or profile.get("role") != "admin":
        raise AppError(
            error="forbidden",
            message="Admin access required.",
            status_code=403,
        )
    return profile


@router.get("/commissions", response_model=list[AdminCommission])
def list_commissions_for_admin(
    authorization: Annotated[str | None, Header()] = None,
) -> list[AdminCommission]:
    """Return commissions for authenticated admins."""
    _require_admin_actor(authorization)
    admin_service = AdminService(get_service_supabase())
    return [AdminCommission.model_validate(row) for row in admin_service.list_commissions()]


@router.get("/employees", response_model=list[AdminEmployee])
def list_employees_for_admin(
    authorization: Annotated[str | None, Header()] = None,
) -> list[AdminEmployee]:
    """Return employee catalog for authenticated admins."""
    _require_admin_actor(authorization)
    admin_service = AdminService(get_service_supabase())
    return [AdminEmployee.model_validate(row) for row in admin_service.list_employees()]


@router.patch("/employees/{employee_id}", response_model=AdminEmployee)
def update_employee_as_admin(
    employee_id: str,
    payload: UpdateEmployeeRequest,
    authorization: Annotated[str | None, Header()] = None,
) -> AdminEmployee:
    """Update employee role/active status as authenticated admin."""
    _require_admin_actor(authorization)
    admin_service = AdminService(get_service_supabase())
    updated = admin_service.update_employee(
        employee_id=employee_id, role=payload.role, active=payload.active
    )
    return AdminEmployee.model_validate(updated)


@router.post("/commissions/export-previous-month")
def export_previous_month_open_commissions(
    authorization: Annotated[str | None, Header()] = None,
) -> Response:
    """Export last month's open commissions to CSV and mark them paid."""
    actor = _require_admin_actor(authorization)

    export_service = AdminExportService(get_service_supabase())
    export_result = export_service.export_open_commissions_for_previous_month()

    logger.info(
        "admin_commissions_export",
        extra={
            "actor_employee_id": actor.get("id"),
            "actor_auth_user_id": actor.get("auth_user_id"),
            "actor_email": actor.get("email"),
            "month": export_result.month_label,
            "row_count": export_result.row_count,
        },
    )

    return Response(
        content=export_result.csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{export_result.filename}"'
            ),
            "X-Exported-Row-Count": str(export_result.row_count),
        },
    )
