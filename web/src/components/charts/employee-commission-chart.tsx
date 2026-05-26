"use client";

import { useEffect, useRef, useState } from "react";
import type { Chart as ChartType } from "chart.js";

interface EmployeeCommissionChartProps {
  labels: string[];
  paid: number[];
  open: number[];
}

function euroK(value: number): string {
  return `€${(value / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })}K`;
}

function euroFull(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

export function EmployeeCommissionChart({ labels, paid, open }: EmployeeCommissionChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartType | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    void (async () => {
      try {
        const { Chart, registerables } = await import("chart.js");

        if (cancelled || !canvasRef.current) return;

        Chart.register(...registerables);
        chartRef.current?.destroy();

        chartRef.current = new Chart(canvas, {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                label: "Bezahlt",
                data: paid,
                backgroundColor: "rgba(34, 197, 94, 0.7)",
                borderColor: "rgba(34, 197, 94, 1)",
                borderWidth: 1,
                borderRadius: 4,
              },
              {
                label: "Offen",
                data: open,
                backgroundColor: "rgba(251, 146, 60, 0.7)",
                borderColor: "rgba(251, 146, 60, 1)",
                borderWidth: 1,
                borderRadius: 4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: {
                position: "top",
                labels: { color: "#a3a3a3", boxWidth: 12, padding: 16, font: { size: 12 } },
              },
              tooltip: {
                backgroundColor: "#1a1a1a",
                borderColor: "#333",
                borderWidth: 1,
                titleColor: "#fff",
                bodyColor: "#a3a3a3",
                padding: 10,
                callbacks: {
                  label(ctx) {
                    return ` ${ctx.dataset.label}: ${euroFull(ctx.parsed.y ?? 0)}`;
                  },
                },
              },
            },
            scales: {
              x: {
                ticks: { color: "#737373", font: { size: 11 } },
                grid: { color: "rgba(255,255,255,0.04)" },
              },
              y: {
                ticks: { color: "#737373", font: { size: 11 }, callback: (v) => euroK(Number(v)) },
                grid: { color: "rgba(255,255,255,0.06)" },
              },
            },
          },
        });
      } catch (err) {
        if (!cancelled) {
          setChartError(err instanceof Error ? err.message : "Chart konnte nicht geladen werden.");
        }
      }
    })();

    return () => {
      cancelled = true;
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [labels, paid, open]);

  if (labels.length === 0) {
    return (
      <div className="metric-card flex items-center justify-center" style={{ height: 300 }}>
        <p className="text-sm text-[var(--brand-text-muted)]">Keine Provisionsdaten vorhanden.</p>
      </div>
    );
  }

  if (chartError) {
    return (
      <div className="metric-card flex flex-col items-center justify-center gap-2" style={{ height: 300 }}>
        <p className="text-sm font-semibold text-red-400">Diagramm-Fehler</p>
        <pre className="text-xs text-[var(--brand-text-muted)]">{chartError}</pre>
      </div>
    );
  }

  return (
    <div className="metric-card">
      <p className="mb-4 text-sm font-semibold text-white">Provisionsübersicht</p>
      <div style={{ position: "relative", height: 260 }}>
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
