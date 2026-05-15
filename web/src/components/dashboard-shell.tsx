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
    <main className="app-page">
      <div className="dashboard-nav">
        <div className="logo-slot">
          <span className="logo-badge">go</span>
          <div>
            <p className="text-sm font-semibold text-white">go!commerce style</p>
            <p className="text-xs text-[var(--brand-text-muted)]">Platz fuer dein Logo</p>
          </div>
        </div>
        <p className="text-xs text-[var(--brand-text-muted)]">Provisionen Dashboard</p>
      </div>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          <p className="mt-1 text-sm text-[var(--brand-text-muted)]">{subtitle}</p>
        </div>
        {actions}
      </header>
      <section className="brand-card p-5">
        {children}
      </section>
    </main>
  );
}
