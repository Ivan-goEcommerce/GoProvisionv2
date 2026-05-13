"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
    return <main className="p-6 text-sm text-zinc-600">Loading employee dashboard...</main>;
  }

  return (
    <DashboardShell
      title="Mitarbeiter Dashboard"
      subtitle={`Willkommen ${employeeName || "Mitarbeiter"}`}
      actions={
        <button
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          onClick={onLogout}
          type="button"
        >
          Logout
        </button>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">Gesamt open</p>
          <p className="text-lg font-semibold text-zinc-900">{formatEuro(totals.open)}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">Gesamt paid</p>
          <p className="text-lg font-semibold text-zinc-900">{formatEuro(totals.paid)}</p>
        </div>
      </div>

      {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm text-zinc-700">
          Status
          <select
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm"
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
        <label className="text-sm text-zinc-700">
          Monat (optional)
          <input
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm"
            onChange={(event) => setMonthFilter(event.target.value)}
            type="month"
            value={monthFilter}
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-600">
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
              <tr className="border-b border-zinc-100 text-zinc-800" key={row.id}>
                <td className="py-2 pr-4">{new Date(row.created_at).toLocaleDateString("de-DE")}</td>
                <td className="py-2 pr-4">{row.reason}</td>
                <td className="py-2 pr-4">{formatEuro(row.revenue_amount)}</td>
                <td className="py-2 pr-4">{(row.commission_rate * 100).toFixed(2)}%</td>
                <td className="py-2 pr-4">{formatEuro(row.commission_amount)}</td>
                <td className="py-2 pr-4">{row.status}</td>
              </tr>
            ))}
            {filteredCommissions.length === 0 ? (
              <tr>
                <td className="py-4 text-zinc-500" colSpan={6}>
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
