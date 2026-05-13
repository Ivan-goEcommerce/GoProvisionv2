"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function readRequiredEnv(value: string | undefined, name: string): string {
  if (!value) {
    const availablePublicKeys = Object.keys(process.env)
      .filter((key) => key.startsWith("NEXT_PUBLIC_"))
      .sort();

    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Restart the Next.js dev server after editing env files. ` +
        `Available NEXT_PUBLIC_* keys: ${availablePublicKeys.join(", ") || "none"}`
    );
  }
  return value;
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = readRequiredEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL"
  );
  const supabaseAnonKey = readRequiredEnv(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );

  browserClient = createClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}
