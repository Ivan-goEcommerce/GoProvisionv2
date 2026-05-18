"""Admin CSV import workflow for commissions."""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation

from postgrest.exceptions import APIError as PostgrestApiError
from supabase import Client

from backend.core.errors import AppError
from backend.schemas.admin import CommissionImportResponse, CommissionImportRowError
from backend.schemas.webhook import ALLOWED_COMMISSION_STATUSES


@dataclass(frozen=True)
class ParsedCommissionRow:
    """Validated CSV row ready for persistence."""

    employee_id: str
    reason: str
    description: str | None
    revenue_amount: Decimal
    commission_rate: Decimal
    commission_amount: Decimal
    status: str
    source_url: str | None
    external_id: str | None
    created_at: str | None


class AdminImportService:
    """Imports commissions from admin-uploaded CSV files."""

    REQUIRED_COLUMNS = ("reason", "revenue_amount", "commission_rate")

    def __init__(self, supabase_client: Client) -> None:
        self.supabase = supabase_client

    def import_commissions_from_csv(self, file_bytes: bytes) -> CommissionImportResponse:
        """Parse, validate and insert commissions from CSV content."""
        reader = self._build_reader(file_bytes)
        employees_by_id, employees_by_email = self._load_employee_lookup()

        imported_count = 0
        total_rows = 0
        errors: list[CommissionImportRowError] = []

        for row_number, row in enumerate(reader, start=2):
            normalized_row = self._normalize_row(row)
            if self._is_empty_row(normalized_row):
                continue

            total_rows += 1
            try:
                parsed = self._parse_row(
                    row=normalized_row,
                    row_number=row_number,
                    employees_by_id=employees_by_id,
                    employees_by_email=employees_by_email,
                )
                self._insert_row(parsed)
                imported_count += 1
            except (AppError, PostgrestApiError, ValueError) as exc:
                message = self._row_error_message(exc)
                errors.append(CommissionImportRowError(row_number=row_number, message=message))

        return CommissionImportResponse(
            total_rows=total_rows,
            imported_count=imported_count,
            failed_count=len(errors),
            errors=errors[:20],
        )

    def _build_reader(self, file_bytes: bytes) -> csv.DictReader:
        try:
            content = file_bytes.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise AppError(
                error="validation_error",
                message="CSV must be UTF-8 encoded.",
                status_code=422,
            ) from exc

        reader = csv.DictReader(io.StringIO(content))
        if not reader.fieldnames:
            raise AppError(
                error="validation_error",
                message="CSV header is missing.",
                status_code=422,
            )

        normalized_headers = [self._normalize_header(name) for name in reader.fieldnames]
        missing_columns = [name for name in self.REQUIRED_COLUMNS if name not in normalized_headers]
        has_employee_column = (
            "employee_id" in normalized_headers or "employee_email" in normalized_headers
        )
        if missing_columns or not has_employee_column:
            missing_parts = []
            if missing_columns:
                missing_parts.append(f"missing required columns: {', '.join(missing_columns)}")
            if not has_employee_column:
                missing_parts.append("either employee_id or employee_email column is required")
            raise AppError(
                error="validation_error",
                message=f"Invalid CSV header ({'; '.join(missing_parts)}).",
                status_code=422,
            )
        return reader

    def _load_employee_lookup(self) -> tuple[dict[str, str], dict[str, str]]:
        response = (
            self.supabase.table("employees")
            .select("id, email")
            .execute()
        )
        rows = response.data or []
        by_id = {str(row["id"]).strip(): str(row["id"]).strip() for row in rows if row.get("id")}
        by_email = {
            str(row["email"]).strip().lower(): str(row["id"]).strip()
            for row in rows
            if row.get("email") and row.get("id")
        }
        return by_id, by_email

    def _parse_row(
        self,
        row: dict[str, str],
        row_number: int,
        employees_by_id: dict[str, str],
        employees_by_email: dict[str, str],
    ) -> ParsedCommissionRow:
        employee_id = self._resolve_employee_id(
            row=row,
            row_number=row_number,
            employees_by_id=employees_by_id,
            employees_by_email=employees_by_email,
        )
        reason = self._required_text(row.get("reason"), "reason")
        revenue_amount = self._parse_positive_decimal(row.get("revenue_amount"), "revenue_amount")
        commission_rate = self._parse_positive_decimal(
            row.get("commission_rate"), "commission_rate"
        )
        commission_amount = revenue_amount * commission_rate
        status = self._parse_status(row.get("status"))
        created_at = self._parse_created_at(row.get("created_at"))

        return ParsedCommissionRow(
            employee_id=employee_id,
            reason=reason,
            description=self._optional_text(row.get("description")),
            revenue_amount=revenue_amount,
            commission_rate=commission_rate,
            commission_amount=commission_amount,
            status=status,
            source_url=self._optional_text(row.get("source_url")),
            external_id=self._optional_text(row.get("external_id")),
            created_at=created_at,
        )

    def _insert_row(self, parsed_row: ParsedCommissionRow) -> None:
        payload = {
            "employee_id": parsed_row.employee_id,
            "revenue_amount": str(parsed_row.revenue_amount),
            "commission_rate": str(parsed_row.commission_rate),
            "commission_amount": str(parsed_row.commission_amount),
            "reason": parsed_row.reason,
            "description": parsed_row.description,
            "source_url": parsed_row.source_url,
            "status": parsed_row.status,
            "source": "admin_csv_import",
            "external_id": parsed_row.external_id,
        }
        if parsed_row.created_at:
            payload["created_at"] = parsed_row.created_at

        self.supabase.table("commissions").insert(payload).execute()

    def _resolve_employee_id(
        self,
        row: dict[str, str],
        row_number: int,
        employees_by_id: dict[str, str],
        employees_by_email: dict[str, str],
    ) -> str:
        raw_employee_id = self._optional_text(row.get("employee_id"))
        if raw_employee_id:
            if raw_employee_id in employees_by_id:
                return raw_employee_id
            raise ValueError(f"unknown employee_id '{raw_employee_id}'")

        raw_employee_email = self._optional_text(row.get("employee_email"))
        if raw_employee_email:
            employee_id = employees_by_email.get(raw_employee_email.lower())
            if employee_id:
                return employee_id
            raise ValueError(f"unknown employee_email '{raw_employee_email}'")

        raise ValueError(
            f"row {row_number} requires employee_id or employee_email"
        )

    @staticmethod
    def _required_text(value: str | None, field_name: str) -> str:
        normalized = (value or "").strip()
        if not normalized:
            raise ValueError(f"{field_name} is required")
        return normalized

    @staticmethod
    def _optional_text(value: str | None) -> str | None:
        normalized = (value or "").strip()
        return normalized or None

    @staticmethod
    def _parse_positive_decimal(value: str | None, field_name: str) -> Decimal:
        raw = (value or "").strip()
        if not raw:
            raise ValueError(f"{field_name} is required")
        try:
            parsed = Decimal(raw)
        except InvalidOperation as exc:
            raise ValueError(f"{field_name} must be a valid decimal number") from exc
        if parsed <= 0:
            raise ValueError(f"{field_name} must be greater than 0")
        return parsed

    @staticmethod
    def _parse_status(value: str | None) -> str:
        normalized = (value or "open").strip().lower()
        if normalized not in ALLOWED_COMMISSION_STATUSES:
            allowed = ", ".join(ALLOWED_COMMISSION_STATUSES)
            raise ValueError(f"status must be one of: {allowed}")
        return normalized

    @staticmethod
    def _parse_created_at(value: str | None) -> str | None:
        raw = (value or "").strip()
        if not raw:
            return None
        normalized = raw.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError as exc:
            raise ValueError("created_at must be an ISO timestamp") from exc

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC).isoformat()

    @staticmethod
    def _normalize_row(row: dict[str, str | None]) -> dict[str, str]:
        normalized: dict[str, str] = {}
        for key, value in row.items():
            normalized_key = AdminImportService._normalize_header(key)
            normalized[normalized_key] = value or ""
        return normalized

    @staticmethod
    def _is_empty_row(row: dict[str, str]) -> bool:
        return all(not value.strip() for value in row.values())

    @staticmethod
    def _normalize_header(name: str | None) -> str:
        raw = (name or "").strip().lower()
        compact = raw.replace("-", "_").replace(" ", "_")
        aliases = {
            "employeeid": "employee_id",
            "employeeemail": "employee_email",
            "sourceurl": "source_url",
            "externalid": "external_id",
            "createdat": "created_at",
            "commissionrate": "commission_rate",
            "commissionamount": "commission_amount",
            "revenueamount": "revenue_amount",
        }
        return aliases.get(compact.replace("_", ""), compact)

    @staticmethod
    def _row_error_message(exc: Exception) -> str:
        if isinstance(exc, AppError):
            return exc.message
        if isinstance(exc, PostgrestApiError):
            details = getattr(exc, "details", None)
            message = getattr(exc, "message", "") or str(exc)
            if details:
                return f"{message} ({details})"
            return message
        return str(exc)
