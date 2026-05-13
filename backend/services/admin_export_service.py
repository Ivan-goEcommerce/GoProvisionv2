"""Admin export workflows for commissions."""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import UTC, datetime

from supabase import Client


@dataclass(frozen=True)
class ExportWindow:
    """UTC time window for previous calendar month."""

    start_iso: str
    end_iso: str
    label: str


@dataclass(frozen=True)
class ExportResult:
    """Result of exporting and marking commissions as paid."""

    csv_bytes: bytes
    filename: str
    row_count: int
    month_label: str


class AdminExportService:
    """Exports open commissions and marks them as paid."""

    def __init__(self, supabase_client: Client) -> None:
        self.supabase = supabase_client

    def export_open_commissions_for_previous_month(self) -> ExportResult:
        """Export open commissions from previous month and atomically pay them."""
        window = self._build_previous_month_window()
        updated_rows = self._mark_as_paid_and_return_rows(window)
        csv_payload = self._to_csv(updated_rows)
        filename = f"commissions_export_{window.label}.csv"
        return ExportResult(
            csv_bytes=csv_payload,
            filename=filename,
            row_count=len(updated_rows),
            month_label=window.label,
        )

    def _mark_as_paid_and_return_rows(self, window: ExportWindow) -> list[dict]:
        response = (
            self.supabase.table("commissions")
            .update(
                {
                    "status": "paid",
                    "paid_at": datetime.now(UTC).isoformat(),
                },
                returning="representation",
            )
            .eq("status", "open")
            .gte("created_at", window.start_iso)
            .lt("created_at", window.end_iso)
            .select(
                "id, employee_id, revenue_amount, commission_rate, commission_amount, reason, description, source_url, status, source, external_id, created_at, paid_at, employee:employees(name,email)"
            )
            .order("created_at", desc=False)
            .execute()
        )
        return response.data or []

    @staticmethod
    def _to_csv(rows: list[dict]) -> bytes:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "id",
                "employee_id",
                "employee_name",
                "employee_email",
                "created_at",
                "paid_at",
                "reason",
                "description",
                "revenue_amount",
                "commission_rate",
                "commission_amount",
                "status",
                "source",
                "external_id",
                "source_url",
            ]
        )

        for row in rows:
            employee_relation = row.get("employee")
            employee = (
                employee_relation[0]
                if isinstance(employee_relation, list) and employee_relation
                else employee_relation
            ) or {}
            writer.writerow(
                [
                    row.get("id", ""),
                    row.get("employee_id", ""),
                    employee.get("name", ""),
                    employee.get("email", ""),
                    row.get("created_at", ""),
                    row.get("paid_at", ""),
                    row.get("reason", ""),
                    row.get("description", ""),
                    row.get("revenue_amount", ""),
                    row.get("commission_rate", ""),
                    row.get("commission_amount", ""),
                    row.get("status", ""),
                    row.get("source", ""),
                    row.get("external_id", ""),
                    row.get("source_url", ""),
                ]
            )

        return output.getvalue().encode("utf-8")

    @staticmethod
    def _build_previous_month_window() -> ExportWindow:
        now = datetime.now(UTC)
        current_month_start = datetime(now.year, now.month, 1, tzinfo=UTC)
        if current_month_start.month == 1:
            previous_month_start = datetime(
                current_month_start.year - 1, 12, 1, tzinfo=UTC
            )
        else:
            previous_month_start = datetime(
                current_month_start.year, current_month_start.month - 1, 1, tzinfo=UTC
            )

        return ExportWindow(
            start_iso=previous_month_start.isoformat(),
            end_iso=current_month_start.isoformat(),
            label=previous_month_start.strftime("%Y-%m"),
        )
