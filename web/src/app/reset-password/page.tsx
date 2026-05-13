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
      setError("Passwort und Bestaetigung stimmen nicht ueberein.");
      return;
    }

    setIsLoading(true);
    try {
      await updatePassword(password);
      await signOut();
      setInfo("Passwort erfolgreich geaendert. Bitte neu einloggen.");
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
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <div className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Neues Passwort setzen</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Verwende ein sicheres Passwort. Danach wirst du zur Anmeldung geleitet.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm text-zinc-700">Neues Passwort</label>
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-700">
              Neues Passwort bestaetigen
            </label>
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              required
            />
          </div>

          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          {info ? (
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{info}</p>
          ) : null}

          <button
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
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
