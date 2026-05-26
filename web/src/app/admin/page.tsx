"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, LogOut, Mail, Settings } from "lucide-react";

import {
  type Commission,
  type CommissionStatusEntry,
  type EmployeeProfile,
  exportPreviousMonthOpenCommissionsCsv,
  getCommissionsForAdmin,
  getCommissionStatuses,
  getCurrentUser,
  getEmployees,
  getEmployeeProfileByAuthUserId,
  signOut,
  updateCommissionStatus,
} from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { CommissionComboChart } from "@/components/charts/commission-combo-chart";

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}


function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const BUILT_IN_STATUSES = ["offen", "in bearbeitung", "bezahlt", "storniert"];

export default function AdminPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [customStatuses, setCustomStatuses] = useState<CommissionStatusEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "offen" | "bezahlt">("all");
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState("");
  const [savingCommissionId, setSavingCommissionId] = useState("");
  const [commissionStatusDrafts, setCommissionStatusDrafts] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [perRowExtraStatuses, setPerRowExtraStatuses] = useState<Record<string, string[]>>({});


  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace("/");
          return;
        }

        const profile = await getEmployeeProfileByAuthUserId(user.id);
        if (!profile.active) {
          await signOut();
          router.replace("/");
          return;
        }
        if (profile.role !== "admin") {
          router.replace("/employee");
          return;
        }

        const [rows, employeeRows, statusRows] = await Promise.all([
          getCommissionsForAdmin(),
          getEmployees(),
          getCommissionStatuses(),
        ]);
        setEmployeeName(profile.name);
        setCommissions(rows);
        setEmployees(employeeRows);
        setCustomStatuses(statusRows);

        const allOpts = [
          ...BUILT_IN_STATUSES,
          ...statusRows
            .map((s) => s.name)
            .filter((name) => !BUILT_IN_STATUSES.some((b) => b.toLowerCase() === name.toLowerCase())),
        ];
        const initExtras: Record<string, string[]> = {};
        for (const row of rows) {
          if (!allOpts.some((o) => o.toLowerCase() === row.status.toLowerCase())) {
            initExtras[row.id] = [row.status];
          }
        }
        setPerRowExtraStatuses(initExtras);
      } catch (requestError) {
        if (requestError instanceof Error) {
          if (requestError.message === "Admin access required.") {
            router.replace("/employee");
            return;
          }
          if (
            requestError.message === "Missing Authorization header." ||
            requestError.message === "Invalid access token." ||
            requestError.message === "Session missing. Please sign in again."
          ) {
            await signOut();
            router.replace("/");
            return;
          }
          setError(requestError.message);
          return;
        }
        setError("Dashboard konnte nicht geladen werden.");
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, [router]);

  const filteredCommissions = useMemo(() => {
    return commissions.filter((row) => {
      const statusMatches =
        statusFilter === "all" ||
        (statusFilter === "bezahlt" && row.status === "bezahlt") ||
        (statusFilter === "offen" && row.status !== "bezahlt" && row.status !== "storniert");
      if (!statusMatches) return false;

      if (employeeFilter !== "all" && row.employee_id !== employeeFilter) return false;

      if (!monthFilter) return true;

      const [year, month] = monthFilter.split("-");
      const commissionDate = new Date(row.created_at);
      const commissionYear = String(commissionDate.getFullYear());
      const commissionMonth = String(commissionDate.getMonth() + 1).padStart(2, "0");
      return commissionYear === year && commissionMonth === month;
    });
  }, [commissions, employeeFilter, monthFilter, statusFilter]);

  const totals = useMemo(() => {
    return {
      open: filteredCommissions
        .filter((row) => row.status !== "bezahlt" && row.status !== "storniert")
        .reduce((sum, row) => sum + row.commission_amount, 0),
      paid: filteredCommissions
        .filter((row) => row.status === "bezahlt")
        .reduce((sum, row) => sum + row.commission_amount, 0),
    };
  }, [filteredCommissions]);

  const allStatusOptions = useMemo(() => {
    const customNames = customStatuses
      .map((s) => s.name)
      .filter((name) => !BUILT_IN_STATUSES.some((b) => b.toLowerCase() === name.toLowerCase()));
    return [...BUILT_IN_STATUSES, ...customNames];
  }, [customStatuses]);

  const monthlyChartData = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of commissions) {
      if (row.status === "storniert") continue;
      const d = new Date(row.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) ?? 0) + row.commission_amount);
    }
    const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    const labels = sorted.map(([key]) => {
      const [year, month] = key.split("-");
      return new Date(Number(year), Number(month) - 1).toLocaleDateString("de-DE", {
        month: "short",
        year: "2-digit",
      });
    });
    const monthly = sorted.map(([, v]) => v);
    const cumulative = monthly.reduce<number[]>((acc, v) => {
      acc.push((acc[acc.length - 1] ?? 0) + v);
      return acc;
    }, []);
    return { labels, monthly, cumulative };
  }, [commissions]);

  const updateCommissionDraftStatus = (commissionId: string, status: string) => {
    setCommissionStatusDrafts((current) => ({ ...current, [commissionId]: status }));
  };

  const onSaveCommissionStatus = async (commission: Commission) => {
    const nextStatus = commissionStatusDrafts[commission.id] ?? commission.status;
    if (nextStatus === commission.status) return;

    setError("");
    setInfo("");
    setSavingCommissionId(commission.id);
    try {
      const updated = await updateCommissionStatus(commission.id, { status: nextStatus });
      setCommissions((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      setCommissionStatusDrafts((current) => {
        const next = { ...current };
        delete next[updated.id];
        return next;
      });
      setInfo(`Provision ${updated.id} wurde auf ${updated.status} gesetzt.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Provision-Status konnte nicht aktualisiert werden.",
      );
    } finally {
      setSavingCommissionId("");
    }
  };

  const onInlineEditSave = async (commission: Commission) => {
    const trimmed = inlineEditValue.trim();
    setInlineEditId(null);
    if (!trimmed || trimmed === commission.status) return;

    setError("");
    setInfo("");
    setSavingCommissionId(commission.id);
    try {
      const updated = await updateCommissionStatus(commission.id, { status: trimmed });
      setCommissions((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      setCommissionStatusDrafts((current) => {
        const next = { ...current };
        delete next[updated.id];
        return next;
      });
      if (!allStatusOptions.some((o) => o.toLowerCase() === trimmed.toLowerCase())) {
        setPerRowExtraStatuses((prev) => {
          const existing = prev[commission.id] ?? [];
          if (existing.some((e) => e.toLowerCase() === trimmed.toLowerCase())) return prev;
          return { ...prev, [commission.id]: [...existing, trimmed] };
        });
      }
      setInfo(`Provision ${updated.id} wurde auf „${updated.status}" gesetzt.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Provision-Status konnte nicht aktualisiert werden.",
      );
    } finally {
      setSavingCommissionId("");
    }
  };

  const onLogout = async () => {
    await signOut();
    router.replace("/");
  };

  const onExportOpenPreviousMonth = async () => {
    setError("");
    setInfo("");
    setIsExporting(true);
    try {
      const result = await exportPreviousMonthOpenCommissionsCsv();
      const objectUrl = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = result.filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      const refreshed = await getCommissionsForAdmin();
      setCommissions(refreshed);
      const emptyHint =
        result.rowCount === 0 && result.emptyReason
          ? ` Hinweis: ${result.emptyReason}`
          : "";
      setInfo(
        `CSV exportiert (${result.filename}). ${result.rowCount} exportierte Provisionen wurden auf bezahlt gesetzt.${emptyHint}`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Export fehlgeschlagen.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const onSendEmail = async () => {
    const recipients = employees.filter((e) => e.receive_email);
    if (recipients.length === 0) {
      setError("Keine Empfänger konfiguriert. Bitte in der Verwaltung 'E-Mail erhalten' aktivieren.");
      return;
    }
    setError("");
    setInfo("");
    setIsSendingEmail(true);
    try {
      const result = await exportPreviousMonthOpenCommissionsCsv();
      const csvBase64 = await blobToBase64(result.blob);
      const selectedEmails = recipients.map((e) => e.email);

      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: selectedEmails, csvBase64, filename: result.filename }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? "E-Mail konnte nicht gesendet werden.");
      }

      const refreshed = await getCommissionsForAdmin();
      setCommissions(refreshed);
      const emptyHint = result.rowCount === 0 && result.emptyReason ? ` Hinweis: ${result.emptyReason}` : "";
      setInfo(
        `E-Mail mit „${result.filename}" an ${selectedEmails.length} Empfänger gesendet. ${result.rowCount} Provisionen auf bezahlt gesetzt.${emptyHint}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "E-Mail konnte nicht gesendet werden.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (isLoading) {
    return <main className="p-6 text-sm text-[var(--brand-text-muted)]">Lade Dashboard...</main>;
  }

  return (
    <DashboardShell
      title="Admin Dashboard"
      subtitle={`Angemeldet als ${employeeName || "Admin"}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="brand-button-secondary"
            onClick={() => router.push("/admin/verwaltung")}
            type="button"
          >
            <Settings size={16} />
            Admin Verwaltung
          </button>
          <button
            className="brand-button-accent disabled:opacity-60"
            disabled={isExporting}
            onClick={onExportOpenPreviousMonth}
            type="button"
          >
            <Download size={16} />
            {isExporting ? "Exportiere..." : "CSV-Export"}
          </button>

          {/* E-Mail senden */}
          <button
            className="brand-button-secondary disabled:opacity-60"
            disabled={isSendingEmail}
            onClick={() => { void onSendEmail(); }}
            type="button"
          >
            <Mail size={16} />
            {isSendingEmail ? "Senden..." : "E-Mail senden"}
          </button>

          <button
            className="brand-button-secondary"
            onClick={onLogout}
            type="button"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="metric-card">
          <p className="text-xs text-[var(--brand-text-muted)]">Gesamt offen</p>
          <p className="text-lg font-semibold text-white">{formatEuro(totals.open)}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-[var(--brand-text-muted)]">Gesamt bezahlt</p>
          <p className="text-lg font-semibold text-white">{formatEuro(totals.paid)}</p>
        </div>
      </div>

      <div className="mb-6">
        <CommissionComboChart
          cumulative={monthlyChartData.cumulative}
          labels={monthlyChartData.labels}
          monthly={monthlyChartData.monthly}
        />
      </div>

      {error ? <p className="brand-error mb-4 rounded-md px-3 py-2 text-sm">{error}</p> : null}
      {info ? <p className="brand-success mb-4 rounded-md px-3 py-2 text-sm">{info}</p> : null}

      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm text-[var(--brand-text-muted)]">
          Mitarbeiter
          <select
            className="brand-input mt-1 block"
            onChange={(event) => setEmployeeFilter(event.target.value)}
            value={employeeFilter}
          >
            <option value="all">Alle</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-[var(--brand-text-muted)]">
          Monat
          <input
            className="brand-input mt-1 block"
            onChange={(event) => setMonthFilter(event.target.value)}
            type="month"
            value={monthFilter}
          />
        </label>
        <label className="text-sm text-[var(--brand-text-muted)]">
          Status
          <select
            className="brand-input mt-1 block"
            onChange={(event) =>
              setStatusFilter(event.target.value as "all" | "offen" | "bezahlt")
            }
            value={statusFilter}
          >
            <option value="all">Alle</option>
            <option value="offen">Offen</option>
            <option value="bezahlt">Bezahlt</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table min-w-[900px]">
          <thead>
            <tr className="text-left">
              <th className="py-2 pr-4">Datum</th>
              <th className="py-2 pr-4">Mitarbeiter</th>
              <th className="py-2 pr-4">Grund</th>
              <th className="py-2 pr-4">Umsatz</th>
              <th className="py-2 pr-4">Satz</th>
              <th className="py-2 pr-4">Betrag</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {filteredCommissions.map((row) => (
              <tr key={row.id}>
                <td className="py-2 pr-4">{new Date(row.created_at).toLocaleDateString("de-DE")}</td>
                <td className="py-2 pr-4">{row.employee?.name ?? row.employee_id}</td>
                <td className="py-2 pr-4">{row.reason}</td>
                <td className="py-2 pr-4">{formatEuro(row.revenue_amount)}</td>
                <td className="py-2 pr-4">{(row.commission_rate * 100).toFixed(2)}%</td>
                <td className="py-2 pr-4">{formatEuro(row.commission_amount)}</td>
                <td className="py-2 pr-4">
                  {inlineEditId === row.id ? (
                    <input
                      autoFocus
                      className="brand-input px-2 py-1 text-sm"
                      onBlur={() => setInlineEditId(null)}
                      onChange={(e) => setInlineEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { void onInlineEditSave(row); }
                        if (e.key === "Escape") { setInlineEditId(null); }
                      }}
                      placeholder="Status eingeben…"
                      value={inlineEditValue}
                    />
                  ) : (() => {
                    const rawStatus = commissionStatusDrafts[row.id] ?? row.status;
                    const rowExtras = perRowExtraStatuses[row.id] ?? [];
                    const rowOptions = [
                      ...allStatusOptions,
                      ...rowExtras.filter((e) => !allStatusOptions.some((o) => o.toLowerCase() === e.toLowerCase())),
                    ];
                    const canonical = rowOptions.find((o) => o.toLowerCase() === rawStatus.toLowerCase());
                    const currentStatus = canonical ?? rawStatus;
                    const finalOptions = canonical ? rowOptions : [...rowOptions, rawStatus];
                    return (
                      <select
                        className="brand-input px-2 py-1 text-sm"
                        onChange={(event) => updateCommissionDraftStatus(row.id, event.target.value)}
                        onDoubleClick={() => { setInlineEditId(row.id); setInlineEditValue(currentStatus); }}
                        title="Doppelklick für eigenen Status"
                        value={currentStatus}
                      >
                        {finalOptions.map((statusOption) => (
                          <option key={statusOption} value={statusOption}>
                            {statusOption}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </td>
                <td className="py-2 pr-4">
                  <button
                    className="brand-button-secondary px-3 py-1 disabled:opacity-60"
                    disabled={
                      savingCommissionId === row.id ||
                      (commissionStatusDrafts[row.id] ?? row.status) === row.status
                    }
                    onClick={() => onSaveCommissionStatus(row)}
                    type="button"
                  >
                    {savingCommissionId === row.id ? "Speichern..." : "Speichern"}
                  </button>
                </td>
              </tr>
            ))}
            {filteredCommissions.length === 0 ? (
              <tr>
                <td className="py-4 text-[var(--brand-text-muted)]" colSpan={8}>
                  Keine Provisionen gefunden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
