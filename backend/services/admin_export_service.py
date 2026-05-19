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
    """Exports previous-month commissions (excl. cancelled) and marks them as bezahlt."""

    EXCLUDED_STATUSES = ("storniert", "cancelled")
    PAID_STATUS = "bezahlt"

    def __init__(self, supabase_client: Client) -> None:
        self.supabase = supabase_client

    def export_open_commissions_for_previous_month(self) -> ExportResult:
        """Export previous-month commissions and mark them bezahlt in DB."""
        window = self._build_previous_month_window()
        exported_rows = self._mark_exportable_for_window_as_paid(window)
        csv_payload = self._to_csv(exported_rows)
        filename = f"commissions_export_{window.label}.csv"
        empty_reason = None
        if not exported_rows:
            empty_reason = (
                f"Keine Provisionen im Vormonat ({window.label}) gefunden."
            )
        return ExportResult(
            csv_bytes=csv_payload,
            filename=filename,
            row_count=len(exported_rows),
            month_label=window.label,
            empty_reason=empty_reason,
        )

    def _mark_exportable_for_window_as_paid(self, window: ExportWindow) -> list[dict]:
        response = (
            self.supabase.table("commissions")
            .update(
                {
                    "status": self.PAID_STATUS,
                    "paid_at": datetime.now(UTC).isoformat(),
                },
                returning="representation",
            )
            .select(
                "id, employee_id, reason, description, commission_amount, created_at, "
                "employee:employees(name,email)"
            )
            .not_.in_("status", list(self.EXCLUDED_STATUSES))
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
        writer.writerow([
            "employee_name",
            "employee_email",
            "created_at",
            "reason",
            "description",
            "commission_amount",
        ])

        for row in rows:
            employee_relation = row.get("employee")
            employee = (
                employee_relation[0]
                if isinstance(employee_relation, list) and employee_relation
                else employee_relation
            ) or {}

            created_at_raw = row.get("created_at") or ""
            try:
                dt = datetime.fromisoformat(created_at_raw.replace("Z", "+00:00"))
                created_at_formatted = dt.strftime("%d.%m.%Y")
            except (ValueError, AttributeError):
                created_at_formatted = created_at_raw

            writer.writerow([
                employee.get("name") or "",
                employee.get("email") or "",
                created_at_formatted,
                row.get("reason") or "",
                row.get("description") or "",
                row.get("commission_amount", ""),
            ])

        # UTF-8 with BOM for correct Excel/German locale handling
        return output.getvalue().encode("utf-8-sig")
