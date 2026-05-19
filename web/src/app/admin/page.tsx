"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatStatusLabel(status: string): string {
  if (status === "in_bearbeitung") return "In Bearbeitung";
  return status.charAt(0).toUpperCase() + status.slice(1);
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

const BUILT_IN_STATUSES = ["offen", "in_bearbeitung", "bezahlt", "storniert"];

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
  const [monthFilter, setMonthFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [savingCommissionId, setSavingCommissionId] = useState("");
  const [commissionStatusDrafts, setCommissionStatusDrafts] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);

  // E-Mail state
  const [lastExport, setLastExport] = useState<{ blob: Blob; filename: string } | null>(null);
  const [showEmailDropdown, setShowEmailDropdown] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");
  const emailDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emailDropdownRef.current && !emailDropdownRef.current.contains(event.target as Node)) {
        setShowEmailDropdown(false);
      }
    };
    if (showEmailDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmailDropdown]);

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
      .filter((name) => !BUILT_IN_STATUSES.includes(name));
    return [...BUILT_IN_STATUSES, ...customNames];
  }, [customStatuses]);

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
      setInfo(`Provision ${updated.id} wurde auf ${formatStatusLabel(updated.status)} gesetzt.`);
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

      setLastExport({ blob: result.blob, filename: result.filename });

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

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  };

  const onSendEmail = async () => {
    if (!lastExport || selectedEmployeeIds.size === 0) return;
    setEmailError("");
    setIsSendingEmail(true);
    try {
      const csvBase64 = await blobToBase64(lastExport.blob);
      const selectedEmails = employees
        .filter((e) => selectedEmployeeIds.has(e.id))
        .map((e) => e.email);

      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: selectedEmails, csvBase64, filename: lastExport.filename }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? "E-Mail konnte nicht gesendet werden.");
      }

      setShowEmailDropdown(false);
      setSelectedEmployeeIds(new Set());
      setInfo(`E-Mail mit „${lastExport.filename}" an ${selectedEmails.length} Empfänger gesendet.`);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "E-Mail konnte nicht gesendet werden.");
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
          <div className="relative" ref={emailDropdownRef}>
            <button
              className="brand-button-secondary disabled:opacity-40"
              disabled={!lastExport}
              onClick={() => {
                setEmailError("");
                setShowEmailDropdown((v) => !v);
              }}
              title={!lastExport ? "Zuerst CSV exportieren" : ""}
              type="button"
            >
              <Mail size={16} />
              E-Mail senden
            </button>

            {showEmailDropdown && (
              <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-[var(--border)] bg-[var(--brand-bg)] p-4 shadow-xl">
                <p className="mb-3 text-sm font-semibold text-white">Empfänger auswählen</p>
                <div className="mb-3 max-h-52 space-y-2 overflow-y-auto">
                  {employees.map((employee) => (
                    <label
                      key={employee.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-[var(--brand-surface)]"
                    >
                      <input
                        checked={selectedEmployeeIds.has(employee.id)}
                        className="accent-[var(--brand-primary)]"
                        onChange={() => toggleEmployeeSelection(employee.id)}
                        type="checkbox"
                      />
                      <span className="text-white">{employee.name}</span>
                      <span className="ml-auto truncate text-xs text-[var(--brand-text-muted)]">
                        {employee.email}
                      </span>
                    </label>
                  ))}
                </div>
                {emailError ? (
                  <p className="mb-2 text-xs text-red-400">{emailError}</p>
                ) : null}
                <div className="flex gap-2">
                  <button
                    className="brand-button-accent flex-1 disabled:opacity-60"
                    disabled={selectedEmployeeIds.size === 0 || isSendingEmail}
                    onClick={() => { void onSendEmail(); }}
                    type="button"
                  >
                    {isSendingEmail
                      ? "Senden..."
                      : `Senden (${selectedEmployeeIds.size})`}
                  </button>
                  <button
                    className="brand-button-secondary"
                    onClick={() => setShowEmailDropdown(false)}
                    type="button"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>

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
                  <select
                    className="brand-input px-2 py-1 text-sm"
                    onChange={(event) => updateCommissionDraftStatus(row.id, event.target.value)}
                    value={commissionStatusDrafts[row.id] ?? row.status}
                  >
                    {allStatusOptions.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>
                        {formatStatusLabel(statusOption)}
                      </option>
                    ))}
                  </select>
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
