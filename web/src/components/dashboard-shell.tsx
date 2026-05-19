"use client";

import type { ReactNode } from "react";
import { TrendingUp } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

type DashboardShellProps = {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  navExtra?: ReactNode;
  children: ReactNode;
};

export function DashboardShell({
  title,
  subtitle,
  actions,
  navExtra,
  children,
}: DashboardShellProps) {
  return (
    <main className="app-page">
      <div className="dashboard-nav">
        <BrandLogo compact subtitle="Admin und Mitarbeiter Bereich" />
        {navExtra ? (
          <div className="flex flex-1 items-center px-4">{navExtra}</div>
        ) : null}
        <div className="flex items-center gap-1.5 text-xs text-[var(--brand-text-muted)]">
          <TrendingUp size={14} className="text-[var(--brand-primary)]" />
          <span>Provisionen Dashboard</span>
        </div>
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
