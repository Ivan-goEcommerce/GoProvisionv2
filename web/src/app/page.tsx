"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getCurrentUser,
  getEmployeeProfileByAuthUserId,
  sendPasswordRecoveryEmail,
  signInWithEmailPassword,
  signOut,
} from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const tryRestoreSession = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          return;
        }

        const profile = await getEmployeeProfileByAuthUserId(user.id);
        if (!profile.active) {
          await signOut();
          setError("Dein Zugang ist deaktiviert. Bitte Admin kontaktieren.");
          return;
        }

        router.replace(profile.role === "admin" ? "/admin" : "/employee");
      } catch {
        setError("Session konnte nicht geladen werden. Bitte neu anmelden.");
      }
    };

    tryRestoreSession();
  }, [router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setInfo("");
    setIsLoading(true);
    try {
      const user = await signInWithEmailPassword(email.trim(), password);
      const profile = await getEmployeeProfileByAuthUserId(user.id);

      if (!profile.active) {
        await signOut();
        setError("Dein Zugang ist deaktiviert. Bitte Admin kontaktieren.");
        return;
      }

      router.replace(profile.role === "admin" ? "/admin" : "/employee");
    } catch (requestError) {
      if (requestError instanceof Error) {
        setError(requestError.message);
      } else {
        setError("Login fehlgeschlagen.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onPasswordRecovery = async () => {
    setError("");
    setInfo("");
    setIsLoading(true);
    try {
      if (!email.trim()) {
        throw new Error("Bitte zuerst eine E-Mail eintragen.");
      }
      await sendPasswordRecoveryEmail(email.trim());
      setInfo(
        "Passwort-Reset E-Mail wurde versendet. Bitte Link in der E-Mail verwenden.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Passwort-Reset fehlgeschlagen.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="logo-slot">
            <span className="logo-badge">go</span>
            <div>
              <p className="text-sm font-semibold text-white">go!commerce style</p>
              <p className="text-xs text-[var(--brand-text-muted)]">Platz fuer Logo</p>
            </div>
          </div>
        </div>

        <h1 className="auth-title">GoProvisions Login</h1>
        <p className="auth-subtitle">
          Anmeldung ueber Supabase Auth mit E-Mail, Passwort und Passwort-Reset im neuen Markenstil.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="field-label">E-Mail</label>
            <input
              className="brand-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label">Passwort</label>
            <input
              className="brand-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
            {isLoading ? "Anmeldung..." : "Anmelden"}
          </button>
          <button
            className="brand-button-secondary w-full disabled:opacity-60"
            disabled={isLoading}
            onClick={onPasswordRecovery}
            type="button"
          >
            Passwort vergessen
          </button>
        </form>
      </div>
    </main>
  );
}
