"use client";

import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";

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
      <div className="dashboard-nav justify-center">
        <BrandLogo compact subtitle="Admin und Mitarbeiter Bereich" />
      </div>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          <p className="mt-1 text-sm text-[var(--brand-text-muted)]">{subtitle}</p>
        </div>
        {actions}
      </header>
      <section className="brand-card p-5 animate-slide-in">
        {children}
      </section>
    </main>
  );
}
