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
    """Result of exporting commissions for tax advisor workflows."""

    csv_bytes: bytes
    filename: str
    row_count: int
    month_label: str
    empty_reason: str | None = None


class AdminExportService:
    """Exports previous-month pending commissions with paid projection in CSV."""

    PENDING_STATUSES = ("open", "in_progress")

    def __init__(self, supabase_client: Client) -> None:
        self.supabase = supabase_client

    def export_open_commissions_for_previous_month(self) -> ExportResult:
        """Export previous-month open commissions and project them as paid in CSV."""
        window = self._build_previous_month_window()
        rows = self._list_pending_for_window(window)
        exported_rows = self._project_rows_as_paid(rows)
        csv_payload = self._to_csv(exported_rows)
        filename = f"commissions_export_{window.label}.csv"
        empty_reason = None
        if not exported_rows:
            empty_reason = (
                f"Keine offenen Provisionen im Vormonat ({window.label}) gefunden."
            )
        return ExportResult(
            csv_bytes=csv_payload,
            filename=filename,
            row_count=len(exported_rows),
            month_label=window.label,
            empty_reason=empty_reason,
        )

    def _list_pending_for_window(self, window: ExportWindow) -> list[dict]:
        response = (
            self.supabase.table("commissions")
            .select(
                "id, employee_id, revenue_amount, commission_rate, commission_amount, reason, description, source_url, status, source, external_id, created_at, paid_at, employee:employees(name,email)"
            )
            .in_("status", self.PENDING_STATUSES)
            .gte("created_at", window.start_iso)
            .lt("created_at", window.end_iso)
            .execute()
        )
        rows = response.data or []
        return sorted(
            rows,
            key=lambda row: (
                row.get("created_at") or "",
                str(row.get("id") or ""),
            ),
        )

    @staticmethod
    def _project_rows_as_paid(rows: list[dict]) -> list[dict]:
        paid_at_iso = datetime.now(UTC).isoformat()
        projected_rows: list[dict] = []
        for row in rows:
            projected_rows.append(
                {
                    **row,
                    "status": "paid",
                    "paid_at": paid_at_iso,
                }
            )
        return projected_rows

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

