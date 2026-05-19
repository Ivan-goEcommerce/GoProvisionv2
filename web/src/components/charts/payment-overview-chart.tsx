"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface PaymentOverviewChartProps {
  paid: number;
  outstanding: number;
  compact?: boolean;
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

const COLORS = {
  paid: "#22c55e",
  outstanding: "#ff6b00",
  empty: "#333333",
};

export function PaymentOverviewChart({ paid, outstanding, compact }: PaymentOverviewChartProps) {
  const total = paid + outstanding;
  const hasData = total > 0;

  const data = hasData
    ? [
        { name: "Bezahlt", value: paid, color: COLORS.paid },
        { name: "Ausstehend", value: outstanding, color: COLORS.outstanding },
      ]
    : [{ name: "Keine Daten", value: 1, color: COLORS.empty }];

  const paidPercent = hasData ? Math.round((paid / total) * 100) : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="relative shrink-0" style={{ width: 80, height: 80 }}>
          <PieChart height={80} width={80}>
            <Pie
              cx={40}
              cy={40}
              data={data}
              dataKey="value"
              innerRadius={22}
              outerRadius={34}
              paddingAngle={hasData ? 3 : 0}
              startAngle={90}
              endAngle={-270}
            >
              {data.map((entry, index) => (
                <Cell fill={entry.color} key={`cell-${index}`} stroke="transparent" />
              ))}
            </Pie>
          </PieChart>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
              {paidPercent}%
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-white leading-tight">Zahlungsübersicht</p>
          <p className="text-[11px] leading-tight mt-1">
            <span style={{ color: COLORS.paid }}>{formatEuro(paid)}</span>
          </p>
          <p className="text-[11px] leading-tight mt-0.5">
            <span style={{ color: COLORS.outstanding }}>{formatEuro(outstanding)}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="metric-card flex flex-col"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="mb-3 text-sm font-semibold text-white">Zahlungsübersicht (aktueller Monat)</p>
      <div className="relative flex flex-1 items-center justify-center">
        <ResponsiveContainer height={180} width="100%">
          <PieChart>
            <Pie
              cx="50%"
              cy="50%"
              data={data}
              dataKey="value"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={hasData ? 3 : 0}
              startAngle={90}
              endAngle={-270}
            >
              {data.map((entry, index) => (
                <Cell fill={entry.color} key={`cell-${index}`} stroke="transparent" />
              ))}
            </Pie>
            {hasData && (
              <Tooltip
                contentStyle={{
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#fff",
                }}
                formatter={(value) => [formatEuro(Number(value)), ""]}
              />
            )}
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-white">{paidPercent}%</span>
          <span className="text-xs text-[var(--brand-text-muted)]">bezahlt</span>
        </div>
      </div>

      <div className="mt-2 flex justify-center gap-5">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS.paid }} />
          <span className="text-xs text-[var(--brand-text-muted)]">Bezahlt</span>
          <span className="text-xs font-medium text-white">{formatEuro(paid)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS.outstanding }} />
          <span className="text-xs text-[var(--brand-text-muted)]">Ausstehend</span>
          <span className="text-xs font-medium text-white">{formatEuro(outstanding)}</span>
        </div>
      </div>
    </div>
  );
}
