"""Admin export workflows for commissions."""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import UTC, datetime

from supabase import Client


@dataclass(frozen=True)
class ExportResult:
    """Result of exporting and marking commissions as paid."""

    csv_bytes: bytes
    filename: str
    row_count: int
    month_label: str
    empty_reason: str | None = None


class AdminExportService:
    """Exports all commissions and marks pending commissions as paid."""

    PENDING_STATUSES = ("open", "in_progress")

    def __init__(self, supabase_client: Client) -> None:
        self.supabase = supabase_client

    def export_open_commissions_for_previous_month(self) -> ExportResult:
        """Export all commissions and mark non-cancelled pending rows as paid."""
        self._mark_pending_as_paid()
        all_rows = self._list_all_commissions()
        csv_payload = self._to_csv(all_rows)
        filename = f"commissions_export_all_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.csv"
        empty_reason = None
        if not all_rows:
            empty_reason = "Keine Provisionen gefunden."
        return ExportResult(
            csv_bytes=csv_payload,
            filename=filename,
            row_count=len(all_rows),
            month_label="all",
            empty_reason=empty_reason,
        )

    def _mark_pending_as_paid(self) -> None:
        self.supabase.table("commissions").update(
            {
                "status": "paid",
                "paid_at": datetime.now(UTC).isoformat(),
            }
        ).in_("status", self.PENDING_STATUSES).execute()

    def _list_all_commissions(self) -> list[dict]:
        response = (
            self.supabase.table("commissions")
            .select(
                "id, employee_id, revenue_amount, commission_rate, commission_amount, reason, description, source_url, status, source, external_id, created_at, paid_at, employee:employees(name,email)"
            )
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

