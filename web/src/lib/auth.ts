"use client";

import { AuthError, type EmailOtpType, type User } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase";

export type EmployeeRole = "admin" | "employee" | "extern";
export type CommissionStatus = "offen" | "in_bearbeitung" | "bezahlt" | "storniert";

export type CommissionStatusEntry = {
  id: string;
  name: string;
};

export type EmployeeProfile = {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  role: EmployeeRole;
  active: boolean;
  receive_email: boolean;
};

export type Commission = {
  id: string;
  employee_id: string;
  reason: string;
  description: string | null;
  revenue_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: string;
  source: string;
  source_url: string | null;
  created_at: string;
  employee?: Pick<EmployeeProfile, "id" | "name" | "email">;
};

export type CommissionFilters = {
  status?: "all" | "open" | "paid";
  month?: string;
  employeeId?: string;
};

export type CreateEmployeeInput = {
  auth_user_id: string;
  name: string;
  email: string;
  role: EmployeeRole;
  active: boolean;
};

export type UpdateEmployeeInput = {
  role?: EmployeeRole;
  active?: boolean;
  receive_email?: boolean;
};

export type UpdateCommissionStatusInput = {
  status: string;
};

export type CsvExportResult = {
  blob: Blob;
  filename: string;
  rowCount: number;
  emptyReason?: string;
};

const SESSION_HINT_COOKIE = "gp_has_session";
const ROLE_HINT_COOKIE = "gp_user_role";

function toErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error. Please try again.";
}

function setCookie(name: string, value: string): void {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
}

function clearCookie(name: string): void {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function markSessionHint(isAuthenticated: boolean): void {
  if (isAuthenticated) {
    setCookie(SESSION_HINT_COOKIE, "1");
    return;
  }
  clearCookie(SESSION_HINT_COOKIE);
  clearCookie(ROLE_HINT_COOKIE);
}

function markRoleHint(role: EmployeeRole): void {
  setCookie(ROLE_HINT_COOKIE, role);
}

function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:8000";
    }
  }
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return "http://localhost:8000";
}

function parseFilenameFromContentDisposition(contentDisposition: string | null): string {
  if (!contentDisposition) {
    return "commissions_export.csv";
  }
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? "commissions_export.csv";
}

type CommissionWithRelation = Omit<Commission, "employee"> & {
  employee?: Pick<EmployeeProfile, "id" | "name" | "email">[] | Pick<EmployeeProfile, "id" | "name" | "email"> | null;
};

function normalizeCommissionRow(row: CommissionWithRelation): Commission {
  const employee = Array.isArray(row.employee) ? row.employee[0] : row.employee;
  return {
    ...row,
    employee: employee ?? undefined,
  };
}

async function getAccessTokenOrThrow(): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    markSessionHint(false);
    throw new Error("Session missing. Please sign in again.");
  }
  markSessionHint(true);
  return data.session.access_token;
}

type BackendErrorResponse = { message?: string };

async function parseBackendError(response: Response, fallback: string): Promise<Error> {
  let message = fallback;
  try {
    const errorBody = (await response.json()) as BackendErrorResponse;
    if (errorBody.message) {
      message = errorBody.message;
    }
  } catch {
    // Ignore invalid error payloads from backend.
  }
  return new Error(message);
}

async function fetchBackendJson<T>(
  path: string,
  init: RequestInit,
  fallbackErrorMessage: string
): Promise<T> {
  const token = await getAccessTokenOrThrow();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw await parseBackendError(response, fallbackErrorMessage);
  }
  return (await response.json()) as T;
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<User> {
  const supabase = getSupabaseBrowserClient();
  // Always reset local auth state before a new login so account switches
  // cannot inherit stale session/role hints from a previous user.
  await supabase.auth.signOut({ scope: "local" });
  markSessionHint(false);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(toErrorMessage(error ?? "Login failed"));
  }
  markSessionHint(true);
  return data.user;
}

export async function sendPasswordRecoveryEmail(email: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    throw new Error(toErrorMessage(error));
  }
}

function cleanupRecoveryUrlParameters(url: URL): void {
  const keysToDelete = ["code", "token_hash", "type", "error", "error_code", "error_description"];
  let changed = false;
  for (const key of keysToDelete) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }

  if (changed && typeof window !== "undefined") {
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }
}

export async function ensurePasswordRecoverySession(): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Passwort-Reset ist nur im Browser verfügbar.");
  }

  const supabase = getSupabaseBrowserClient();
  const url = new URL(window.location.href);

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw new Error(toErrorMessage(error));
    }
    cleanupRecoveryUrlParameters(url);
  } else {
    const tokenHash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type");
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type: type as EmailOtpType,
        token_hash: tokenHash,
      });
      if (error) {
        throw new Error(toErrorMessage(error));
      }
      cleanupRecoveryUrlParameters(url);
    }
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(toErrorMessage(error));
  }
  if (!data.session) {
    throw new Error("Reset-Link ungültig oder abgelaufen. Bitte Passwort-Reset erneut anfordern.");
  }
}

export async function updatePassword(newPassword: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    throw new Error(toErrorMessage(error));
  }
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  markSessionHint(false);
  if (error) {
    throw new Error(toErrorMessage(error));
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(toErrorMessage(error));
  }
  markSessionHint(Boolean(data.user));
  return data.user;
}

export async function getEmployeeProfileByAuthUserId(
  authUserId: string,
): Promise<EmployeeProfile> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, auth_user_id, name, email, role, active")
    .eq("auth_user_id", authUserId)
    .single();

  if (error || !data) {
    throw new Error("Employee profile not found. Please contact an admin.");
  }
  markRoleHint(data.role);
  return data;
}

export async function getCommissionsForAdmin(): Promise<Commission[]> {
  const data = await fetchBackendJson<CommissionWithRelation[]>(
    "/api/admin/commissions",
    { method: "GET" },
    "Could not load commissions for admin."
  );
  return data.map(normalizeCommissionRow);
}

export async function getCommissionsForEmployee(
  employeeId: string
): Promise<Commission[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("commissions")
    .select(
      "id, employee_id, reason, description, revenue_amount, commission_rate, commission_amount, status, source, source_url, created_at",
    )
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(
      `Could not load commissions for employee: ${error.message}`
    );
  }
  return data ?? [];
}

export async function getEmployees(): Promise<EmployeeProfile[]> {
  return fetchBackendJson<EmployeeProfile[]>(
    "/api/admin/employees",
    { method: "GET" },
    "Could not load employees."
  );
}

export async function getCommissionStatuses(): Promise<CommissionStatusEntry[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("status")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) {
    throw new Error(`Provisionsstatus konnten nicht geladen werden: ${error.message}`);
  }
  return data ?? [];
}

export async function createCommissionStatus(name: string): Promise<CommissionStatusEntry> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("status")
    .insert({ name: name.trim() })
    .select("id, name")
    .single();
  if (error || !data) {
    throw new Error("Status konnte nicht erstellt werden.");
  }
  return data;
}

export async function createEmployee(input: CreateEmployeeInput): Promise<EmployeeProfile> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("employees")
    .insert(input)
    .select("id, auth_user_id, name, email, role, active")
    .single();

  if (error || !data) {
    throw new Error("Could not create employee.");
  }
  return data;
}

export async function updateEmployee(
  employeeId: string,
  input: UpdateEmployeeInput
): Promise<EmployeeProfile> {
  return fetchBackendJson<EmployeeProfile>(
    `/api/admin/employees/${employeeId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    "Could not update employee."
  );
}

export async function updateCommissionStatus(
  commissionId: string,
  input: UpdateCommissionStatusInput
): Promise<Commission> {
  const updated = await fetchBackendJson<CommissionWithRelation>(
    `/api/admin/commissions/${commissionId}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    "Could not update commission status."
  );
  return normalizeCommissionRow(updated);
}

export async function exportPreviousMonthOpenCommissionsCsv(): Promise<CsvExportResult> {
  const token = await getAccessTokenOrThrow();

  const response = await fetch(
    `${getApiBaseUrl()}/api/admin/commissions/export-previous-month`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw await parseBackendError(response, "CSV export failed.");
  }

  return {
    blob: await response.blob(),
    filename: parseFilenameFromContentDisposition(
      response.headers.get("content-disposition")
    ),
    rowCount: Number(response.headers.get("x-exported-row-count") ?? "0"),
    emptyReason: response.headers.get("x-export-empty-reason") || undefined,
  };
}

