"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  type Commission,
  type EmployeeProfile,
  exportPreviousMonthOpenCommissionsCsv,
  getCommissionsForAdmin,
  getCurrentUser,
  getEmployees,
  getEmployeeProfileByAuthUserId,
  signOut,
  updateEmployee,
} from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatStatusLabel(status: string): string {
  if (status === "in_progress") {
    return "in progress";
  }
  return status;
}

export default function AdminPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "paid">("all");
  const [monthFilter, setMonthFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [savingEmployeeId, setSavingEmployeeId] = useState("");
  const [isExporting, setIsExporting] = useState(false);

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

        const [rows, employeeRows] = await Promise.all([
          getCommissionsForAdmin(),
          getEmployees(),
        ]);
        setEmployeeName(profile.name);
        setCommissions(rows);
        setEmployees(employeeRows);
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
        setError("Could not load admin dashboard.");
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
        (statusFilter === "paid" && row.status === "paid") ||
        (statusFilter === "open" && row.status !== "paid" && row.status !== "cancelled");
      if (!statusMatches) {
        return false;
      }

      if (employeeFilter !== "all" && row.employee_id !== employeeFilter) {
        return false;
      }

      if (!monthFilter) {
        return true;
      }

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
        .filter((row) => row.status !== "paid" && row.status !== "cancelled")
        .reduce((sum, row) => sum + row.commission_amount, 0),
      paid: filteredCommissions
        .filter((row) => row.status === "paid")
        .reduce((sum, row) => sum + row.commission_amount, 0),
    };
  }, [filteredCommissions]);

  const updateLocalEmployee = (employeeId: string, updates: Partial<EmployeeProfile>) => {
    setEmployees((current) =>
      current.map((employee) =>
        employee.id === employeeId ? { ...employee, ...updates } : employee,
      ),
    );
  };

  const onSaveEmployee = async (employee: EmployeeProfile) => {
    setError("");
    setInfo("");
    setSavingEmployeeId(employee.id);
    try {
      const updated = await updateEmployee(employee.id, {
        role: employee.role,
        active: employee.active,
      });
      updateLocalEmployee(updated.id, updated);
      setInfo(`Mitarbeiter ${updated.name} wurde aktualisiert.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Mitarbeiter konnte nicht aktualisiert werden.");
    } finally {
      setSavingEmployeeId("");
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
      setInfo(
        `CSV exportiert (${result.filename}). ${result.rowCount} Provisionen wurden atomar auf paid gesetzt.`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Export fehlgeschlagen.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return <main className="p-6 text-sm text-[var(--brand-text-muted)]">Loading admin dashboard...</main>;
  }

  return (
    <DashboardShell
      title="Admin Dashboard"
      subtitle={`Angemeldet als ${employeeName || "Admin"}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="brand-button-accent disabled:opacity-60"
            disabled={isExporting}
            onClick={onExportOpenPreviousMonth}
            type="button"
          >
            {isExporting
              ? "Exportiere..."
              : "CSV Export (open Vormonat -> paid)"}
          </button>
          <button
            className="brand-button-secondary"
            onClick={onLogout}
            type="button"
          >
            Logout
          </button>
        </div>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="metric-card">
          <p className="text-xs text-[var(--brand-text-muted)]">Gesamt open</p>
          <p className="text-lg font-semibold text-white">{formatEuro(totals.open)}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-[var(--brand-text-muted)]">Gesamt paid</p>
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
              setStatusFilter(event.target.value as "all" | "open" | "paid")
            }
            value={statusFilter}
          >
            <option value="all">Alle</option>
            <option value="open">Open</option>
            <option value="paid">Paid</option>
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
                <td className="py-2 pr-4">{formatStatusLabel(row.status)}</td>
              </tr>
            ))}
            {filteredCommissions.length === 0 ? (
              <tr>
                <td className="py-4 text-[var(--brand-text-muted)]" colSpan={7}>
                  Keine Provisionen gefunden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-8 border-t border-[var(--border)] pt-6">
        <h2 className="text-lg font-semibold text-white">Mitarbeiterverwaltung</h2>
        <p className="mt-1 text-sm text-[var(--brand-text-muted)]">
          Bestehende Rollen und Aktiv-Status verwalten.
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="data-table min-w-[760px]">
            <thead>
              <tr className="text-left">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">E-Mail</th>
                <th className="py-2 pr-4">Rolle</th>
                <th className="py-2 pr-4">Aktiv</th>
                <th className="py-2 pr-4">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td className="py-2 pr-4">{employee.name}</td>
                  <td className="py-2 pr-4">{employee.email}</td>
                  <td className="py-2 pr-4">
                    <select
                      className="brand-input px-2 py-1 text-sm"
                      onChange={(event) =>
                        updateLocalEmployee(employee.id, {
                          role: event.target.value as "admin" | "employee",
                        })
                      }
                      value={employee.role}
                    >
                      <option value="employee">employee</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      checked={employee.active}
                      onChange={(event) =>
                        updateLocalEmployee(employee.id, { active: event.target.checked })
                      }
                      type="checkbox"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <button
                      className="brand-button-secondary px-3 py-1 disabled:opacity-60"
                      disabled={savingEmployeeId === employee.id}
                      onClick={() => onSaveEmployee(employee)}
                      type="button"
                    >
                      {savingEmployeeId === employee.id ? "Speichern..." : "Speichern"}
                    </button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 ? (
                <tr>
                  <td className="py-4 text-[var(--brand-text-muted)]" colSpan={5}>
                    Keine Mitarbeiter gefunden.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
