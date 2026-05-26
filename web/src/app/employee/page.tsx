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
import { CommissionComboChart } from "@/components/charts/commission-combo-chart";

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
  const [statusFilter, setStatusFilter] = useState<"all" | "offen" | "bezahlt">("all");
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

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
            : "Dashboard konnte nicht geladen werden.",
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
        (statusFilter === "bezahlt" && row.status === "bezahlt") ||
        (statusFilter === "offen" && row.status !== "bezahlt" && row.status !== "storniert");
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
        .filter((row) => row.status !== "bezahlt" && row.status !== "storniert")
        .reduce((sum, row) => sum + row.commission_amount, 0),
      paid: filteredCommissions
        .filter((row) => row.status === "bezahlt")
        .reduce((sum, row) => sum + row.commission_amount, 0),
    };
  }, [filteredCommissions]);

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

  const onLogout = async () => {
    await signOut();
    router.replace("/");
  };

  if (isLoading) {
    return <main className="p-6 text-sm text-[var(--brand-text-muted)]">Lade Dashboard...</main>;
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
        <div className="metric-card stagger-1">
          <p className="text-xs text-[var(--brand-text-muted)]">Gesamt offen</p>
          <p className="text-lg font-semibold text-white">{formatEuro(totals.open)}</p>
        </div>
        <div className="metric-card stagger-2">
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

      <div className="mb-4 flex flex-wrap gap-3">
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
        <label className="text-sm text-[var(--brand-text-muted)]">
          Monat
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
                    {row.status}
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
