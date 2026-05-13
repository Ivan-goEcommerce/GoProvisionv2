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
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <div className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">GoProvisions Login</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Anmeldung ueber Supabase Auth mit E-Mail, Passwort und Passwort-Reset.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm text-zinc-700">E-Mail</label>
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-700">Passwort</label>
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
            {isLoading ? "Anmeldung..." : "Anmelden"}
          </button>
          <button
            className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-60"
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
