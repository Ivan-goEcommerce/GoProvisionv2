"use client";

import type { ReactNode } from "react";

type DashboardShellProps = {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function DashboardShell({
  title,
  subtitle,
  actions,
  children,
}: DashboardShellProps) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
          <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>
        </div>
        {actions}
      </header>
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        {children}
      </section>
    </main>
  );
}
