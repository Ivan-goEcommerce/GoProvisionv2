"use client";

import { AuthError, type User } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase";

export type EmployeeRole = "admin" | "employee";

export type EmployeeProfile = {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  role: EmployeeRole;
  active: boolean;
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
};

export type CsvExportResult = {
  blob: Blob;
  filename: string;
  rowCount: number;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error. Please try again.";
}

function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
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

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<User> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(toErrorMessage(error ?? "Login failed"));
  }
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

export async function updatePassword(newPassword: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    throw new Error(toErrorMessage(error));
  }
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
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

  return data;
}

export async function getCommissionsForAdmin(): Promise<Commission[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("commissions")
    .select(
      "id, employee_id, reason, description, revenue_amount, commission_rate, commission_amount, status, source, source_url, created_at, employee:employees(id,name,email)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error("Could not load commissions for admin.");
  }
  return ((data ?? []) as CommissionWithRelation[]).map(normalizeCommissionRow);
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
    throw new Error("Could not load commissions for employee.");
  }
  return data ?? [];
}

export async function getEmployees(): Promise<EmployeeProfile[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, auth_user_id, name, email, role, active")
    .order("name", { ascending: true })
    .limit(500);

  if (error) {
    throw new Error("Could not load employees.");
  }
  return data ?? [];
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
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("employees")
    .update(input)
    .eq("id", employeeId)
    .select("id, auth_user_id, name, email, role, active")
    .single();

  if (error || !data) {
    throw new Error("Could not update employee.");
  }
  return data;
}

export async function exportPreviousMonthOpenCommissionsCsv(): Promise<CsvExportResult> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Session missing. Please sign in again.");
  }

  const response = await fetch(
    `${getApiBaseUrl()}/api/admin/commissions/export-previous-month`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    }
  );

  if (!response.ok) {
    let message = "CSV export failed.";
    try {
      const errorBody = (await response.json()) as { message?: string };
      if (errorBody.message) {
        message = errorBody.message;
      }
    } catch {
      // Keep generic message when backend does not return JSON.
    }
    throw new Error(message);
  }

  return {
    blob: await response.blob(),
    filename: parseFilenameFromContentDisposition(
      response.headers.get("content-disposition")
    ),
    rowCount: Number(response.headers.get("x-exported-row-count") ?? "0"),
  };
}
