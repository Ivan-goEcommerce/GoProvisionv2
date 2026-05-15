"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { signOut, updatePassword } from "@/lib/auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
      setTimeout(() => router.replace("/"), 1200);
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

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <h1 className="auth-title">Neues Passwort setzen</h1>
        <p className="auth-subtitle">
          Verwende ein sicheres Passwort. Danach wirst du zur Anmeldung geleitet.
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
            <label className="field-label">
              Neues Passwort bestätigen
            </label>
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
            {isLoading ? "Speichern..." : "Passwort aktualisieren"}
          </button>
        </form>
      </div>
    </main>
  );
}
