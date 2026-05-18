"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import {
  type Commission,
  getCommissionsForEmployee,
  getCurrentUser,
  getEmployeeProfileByAuthUserId,
  signOut,
} from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export default function EmployeePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "paid">("all");
  const [monthFilter, setMonthFilter] = useState("");

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

        if (profile.role === "admin") {
          router.replace("/admin");
          return;
        }

        const rows = await getCommissionsForEmployee(profile.id);
        setEmployeeName(profile.name);
        setCommissions(rows);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load employee dashboard.",
        );
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

      if (!monthFilter) {
        return true;
      }

      const [year, month] = monthFilter.split("-");
      const commissionDate = new Date(row.created_at);
      const commissionYear = String(commissionDate.getFullYear());
      const commissionMonth = String(commissionDate.getMonth() + 1).padStart(2, "0");
      return commissionYear === year && commissionMonth === month;
    });
  }, [commissions, monthFilter, statusFilter]);

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

  const onLogout = async () => {
    await signOut();
    router.replace("/");
  };

  if (isLoading) {
    return <main className="p-6 text-sm text-[var(--brand-text-muted)]">Loading employee dashboard...</main>;
  }

  return (
    <DashboardShell
      title="Mitarbeiter Dashboard"
      subtitle={`Willkommen ${employeeName || "Mitarbeiter"}`}
      actions={
        <button
          className="brand-button-secondary"
          onClick={onLogout}
          type="button"
        >
          <LogOut size={16} />
          Logout
        </button>
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

      <div className="mb-4 flex flex-wrap gap-3">
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
        <label className="text-sm text-[var(--brand-text-muted)]">
          Monat (optional)
          <input
            className="brand-input mt-1 block"
            onChange={(event) => setMonthFilter(event.target.value)}
            type="month"
            value={monthFilter}
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table min-w-[780px]">
          <thead>
            <tr className="text-left">
              <th className="py-2 pr-4">Datum</th>
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
                <td className="py-2 pr-4">{row.reason}</td>
                <td className="py-2 pr-4">{formatEuro(row.revenue_amount)}</td>
                <td className="py-2 pr-4">{(row.commission_rate * 100).toFixed(2)}%</td>
                <td className="py-2 pr-4">{formatEuro(row.commission_amount)}</td>
                <td className="py-2 pr-4">
                  <span className={`status-badge status-${row.status}`}>
                    {row.status === "in_progress" ? "in progress" : row.status}
                  </span>
                </td>
              </tr>
            ))}
            {filteredCommissions.length === 0 ? (
              <tr>
                <td className="py-4 text-[var(--brand-text-muted)]" colSpan={6}>
                  Keine Provisionen vorhanden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
