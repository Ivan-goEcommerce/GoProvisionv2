"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, LogOut, Pencil, Plus, Trash2, X } from "lucide-react";

import {
  type CommissionStatusEntry,
  type EmployeeProfile,
  createCommissionStatus,
  deleteCommissionStatus,
  getCurrentUser,
  getCommissionStatuses,
  getEmployeeProfileByAuthUserId,
  getEmployees,
  renameCommissionStatus,
  signOut,
  updateEmployee,
} from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";

export default function AdminVerwaltungPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [employeeName, setEmployeeName] = useState("");

  const [statuses, setStatuses] = useState<CommissionStatusEntry[]>([]);
  const [newStatusName, setNewStatusName] = useState("");
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editingStatusName, setEditingStatusName] = useState("");
  const [deletingStatusId, setDeletingStatusId] = useState<string | null>(null);

  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [savingEmployeeId, setSavingEmployeeId] = useState("");

  useEffect(() => {
    const load = async () => {
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
        const [employeeRows, statusRows] = await Promise.all([
          getEmployees(),
          getCommissionStatuses(),
        ]);
        setEmployeeName(profile.name);
        setEmployees(employeeRows);
        setStatuses(statusRows);
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
        setError("Admin Verwaltung konnte nicht geladen werden.");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [router]);

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
        receive_email: employee.receive_email,
      });
      updateLocalEmployee(updated.id, updated);
      setInfo(`Mitarbeiter ${updated.name} wurde aktualisiert.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Mitarbeiter konnte nicht aktualisiert werden.",
      );
    } finally {
      setSavingEmployeeId("");
    }
  };

  const onCreateStatus = async () => {
    const name = newStatusName.trim();
    if (!name) return;
    setError("");
    setInfo("");
    setIsSavingStatus(true);
    try {
      const created = await createCommissionStatus(name);
      setStatuses((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewStatusName("");
      setInfo(`Status „${created.name}" wurde erstellt.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Status konnte nicht erstellt werden.",
      );
    } finally {
      setIsSavingStatus(false);
    }
  };

  const onStartEditStatus = (status: CommissionStatusEntry) => {
    setEditingStatusId(status.id);
    setEditingStatusName(status.name);
  };

  const onCancelEditStatus = () => {
    setEditingStatusId(null);
    setEditingStatusName("");
  };

  const onSaveEditStatus = async () => {
    const name = editingStatusName.trim();
    if (!name || !editingStatusId) return;
    setError("");
    setInfo("");
    setIsSavingStatus(true);
    try {
      const updated = await renameCommissionStatus(editingStatusId, name);
      setStatuses((current) =>
        current
          .map((s) => (s.id === updated.id ? updated : s))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setEditingStatusId(null);
      setEditingStatusName("");
      setInfo(`Status wurde in „${updated.name}" umbenannt.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Status konnte nicht umbenannt werden.",
      );
    } finally {
      setIsSavingStatus(false);
    }
  };

  const onDeleteStatus = async (id: string) => {
    setError("");
    setInfo("");
    setDeletingStatusId(id);
    try {
      await deleteCommissionStatus(id);
      const deleted = statuses.find((s) => s.id === id);
      setStatuses((current) => current.filter((s) => s.id !== id));
      if (deleted) setInfo(`Status „${deleted.name}" wurde gelöscht.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Status konnte nicht gelöscht werden.",
      );
    } finally {
      setDeletingStatusId(null);
    }
  };

  const onLogout = async () => {
    await signOut();
    router.replace("/");
  };

  if (isLoading) {
    return (
      <main className="p-6 text-sm text-[var(--brand-text-muted)]">
        Lade Admin Verwaltung...
      </main>
    );
  }

  return (
    <DashboardShell
      title="Admin Verwaltung"
      subtitle={`Angemeldet als ${employeeName || "Admin"}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="brand-button-secondary"
            onClick={() => router.push("/admin")}
            type="button"
          >
            <ArrowLeft size={16} />
            Dashboard
          </button>
          <button
            className="brand-button-secondary"
            onClick={() => { void onLogout(); }}
            type="button"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      }
    >
      {error ? <p className="brand-error mb-4 rounded-md px-3 py-2 text-sm">{error}</p> : null}
      {info ? <p className="brand-success mb-4 rounded-md px-3 py-2 text-sm">{info}</p> : null}

      {/* Bereich 1: Provisionsstatus verwalten */}
      <div className="section-block stagger-1">
        <h2 className="text-lg font-semibold text-white">Provisionsstatus verwalten</h2>
        <p className="mt-1 text-sm text-[var(--brand-text-muted)]">
          Eigene Status erstellen, die im gesamten System bei der Status-Auswahl verfügbar sind.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <input
            className="brand-input"
            disabled={isSavingStatus}
            maxLength={50}
            onChange={(e) => setNewStatusName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void onCreateStatus();
              }
            }}
            placeholder="Status-Name eingeben..."
            type="text"
            value={newStatusName}
          />
          <button
            className="brand-button-accent disabled:opacity-60"
            disabled={isSavingStatus || !newStatusName.trim()}
            onClick={() => { void onCreateStatus(); }}
            type="button"
          >
            <Plus size={16} />
            {isSavingStatus ? "Speichern..." : "Hinzufügen"}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {statuses.length > 0 ? (
            statuses.map((status) =>
              editingStatusId === status.id ? (
                <div key={status.id} className="flex items-center gap-2">
                  <input
                    autoFocus
                    className="brand-input flex-1"
                    disabled={isSavingStatus}
                    maxLength={50}
                    onChange={(e) => setEditingStatusName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void onSaveEditStatus();
                      if (e.key === "Escape") onCancelEditStatus();
                    }}
                    value={editingStatusName}
                  />
                  <button
                    className="brand-button-accent px-2 py-1 disabled:opacity-60"
                    disabled={isSavingStatus || !editingStatusName.trim()}
                    onClick={() => { void onSaveEditStatus(); }}
                    title="Speichern"
                    type="button"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    className="brand-button-secondary px-2 py-1"
                    disabled={isSavingStatus}
                    onClick={onCancelEditStatus}
                    title="Abbrechen"
                    type="button"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div key={status.id} className="flex items-center gap-2">
                  <span className="status-chip flex-shrink-0">{status.name}</span>
                  <button
                    className="brand-button-secondary px-2 py-1"
                    disabled={deletingStatusId === status.id}
                    onClick={() => onStartEditStatus(status)}
                    title="Umbenennen"
                    type="button"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="brand-button-secondary px-2 py-1 text-red-400 hover:text-red-300 disabled:opacity-60"
                    disabled={deletingStatusId === status.id}
                    onClick={() => { void onDeleteStatus(status.id); }}
                    title="Löschen"
                    type="button"
                  >
                    {deletingStatusId === status.id ? (
                      <span className="text-xs">...</span>
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              ),
            )
          ) : (
            <p className="text-sm text-[var(--brand-text-muted)]">
              Noch keine benutzerdefinierten Status vorhanden.
            </p>
          )}
        </div>
      </div>

      {/* Bereich 2: Mitarbeiterverwaltung */}
      <div className="section-block stagger-3 mt-8 border-t border-[var(--border)] pt-6">
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
                <th className="py-2 pr-4">E-Mail erhalten</th>
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
                          role: event.target.value as "admin" | "employee" | "extern",
                        })
                      }
                      value={employee.role}
                    >
                      <option value="employee">Mitarbeiter</option>
                      <option value="admin">Administrator</option>
                      <option value="extern">Extern</option>
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
                    <input
                      checked={employee.receive_email}
                      className="accent-[var(--brand-primary)]"
                      onChange={(event) =>
                        updateLocalEmployee(employee.id, { receive_email: event.target.checked })
                      }
                      type="checkbox"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <button
                      className="brand-button-secondary px-3 py-1 disabled:opacity-60"
                      disabled={savingEmployeeId === employee.id}
                      onClick={() => { void onSaveEmployee(employee); }}
                      type="button"
                    >
                      {savingEmployeeId === employee.id ? "Speichern..." : "Speichern"}
                    </button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 ? (
                <tr>
                  <td className="py-4 text-[var(--brand-text-muted)]" colSpan={6}>
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
