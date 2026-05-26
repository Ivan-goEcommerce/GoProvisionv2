"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabase";
import { signOut, updatePassword } from "@/lib/auth";

type SessionState = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>("checking");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let settled = false;

    function markReady() {
      if (!settled) {
        settled = true;
        setSessionState("ready");
      }
    }

    function markInvalid() {
      if (!settled) {
        settled = true;
        setSessionState("invalid");
      }
    }

    // PKCE flow: ?code= in query params
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error: exchangeError }) => {
          if (exchangeError) {
            markInvalid();
          } else {
            markReady();
          }
        })
        .catch(() => markInvalid());
      return;
    }

    // Implicit / OTP flow: Supabase fires PASSWORD_RECOVERY after processing hash or token_hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY" && session) {
          markReady();
        }
        // Supabase sometimes fires SIGNED_IN for recovery sessions
        if (event === "SIGNED_IN" && session?.user) {
          markReady();
        }
      },
    );

    // Also check immediately — in case the client already processed the hash
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        markReady();
      }
    });

    // Fallback: if nothing resolved after 4s, show "invalid"
    const timeout = setTimeout(markInvalid, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setInfo("");

    if (password.length < 10) {
      setError("Passwort muss mindestens 10 Zeichen haben.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Passwort und Bestätigung stimmen nicht überein.");
      return;
    }

    setIsLoading(true);
    try {
      await updatePassword(password);
      await signOut();
      setInfo("Passwort erfolgreich geändert. Bitte neu einloggen.");
      setTimeout(() => router.replace("/"), 1500);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Passwort konnte nicht aktualisiert werden.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (sessionState === "checking") {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <p className="text-sm text-[var(--brand-text-muted)]">Link wird überprüft…</p>
        </div>
      </main>
    );
  }

  if (sessionState === "invalid") {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <h1 className="auth-title">Link ungültig</h1>
          <p className="auth-subtitle">
            Der Reset-Link ist abgelaufen oder wurde bereits verwendet. Bitte neuen Link anfordern.
          </p>
          <button
            className="brand-button-secondary mt-6 w-full"
            onClick={() => router.replace("/")}
            type="button"
          >
            Zurück zum Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <h1 className="auth-title">Neues Passwort setzen</h1>
        <p className="auth-subtitle">
          Verwende ein sicheres Passwort mit mindestens 10 Zeichen.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="field-label">Neues Passwort</label>
            <input
              className="brand-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label">Neues Passwort bestätigen</label>
            <input
              className="brand-input"
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              required
            />
          </div>

          {error ? (
            <p className="brand-error rounded-md px-3 py-2 text-sm">{error}</p>
          ) : null}
          {info ? (
            <p className="brand-success rounded-md px-3 py-2 text-sm">{info}</p>
          ) : null}

          <button
            className="brand-button-accent w-full disabled:opacity-60"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? "Speichern…" : "Passwort aktualisieren"}
          </button>
        </form>
      </div>
    </main>
  );
}
