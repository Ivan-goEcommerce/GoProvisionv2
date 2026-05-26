"use client";

import { useEffect, useRef, useState } from "react";
import type { Chart as ChartType } from "chart.js";

interface EmployeeCommissionChartProps {
  labels: string[];
  paid: number[];
  open: number[];
}

function euroFull(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

export function EmployeeCommissionChart({ paid, open }: EmployeeCommissionChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartType | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);

  const totalPaid = paid.reduce((s, v) => s + v, 0);
  const totalOpen = open.reduce((s, v) => s + v, 0);
  const total = totalPaid + totalOpen;
  const paidPercent = total > 0 ? Math.round((totalPaid / total) * 100) : 0;

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

        // Center-text plugin
        const centerTextPlugin = {
          id: "centerText",
          afterDraw(chart: ChartType) {
            const { ctx, chartArea } = chart;
            if (!chartArea) return;
            const cx = (chartArea.left + chartArea.right) / 2;
            const cy = (chartArea.top + chartArea.bottom) / 2;

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "bold 28px inherit";
            ctx.fillStyle = "#ffffff";
            ctx.fillText(`${paidPercent}%`, cx, cy - 10);
            ctx.font = "13px inherit";
            ctx.fillStyle = "#737373";
            ctx.fillText("bezahlt", cx, cy + 16);
            ctx.restore();
          },
        };

        chartRef.current = new Chart(canvas, {
          type: "doughnut",
          plugins: [centerTextPlugin],
          data: {
            labels: ["Bezahlt", "Offen"],
            datasets: [
              {
                data: [totalPaid, totalOpen],
                backgroundColor: ["rgba(34, 197, 94, 0.8)", "rgba(251, 146, 60, 0.75)"],
                borderColor: ["rgba(34, 197, 94, 1)", "rgba(251, 146, 60, 1)"],
                borderWidth: 2,
                hoverOffset: 8,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            // @ts-expect-error cutout is doughnut-specific and not in the generic union type
            cutout: "68%",
            plugins: {
              legend: {
                position: "bottom",
                labels: {
                  color: "#a3a3a3",
                  boxWidth: 12,
                  padding: 20,
                  font: { size: 12 },
                },
              },
              tooltip: {
                backgroundColor: "#1a1a1a",
                borderColor: "#333",
                borderWidth: 1,
                titleColor: "#fff",
                bodyColor: "#a3a3a3",
                padding: 12,
                callbacks: {
                  label(ctx) {
                    const val = ctx.parsed as number;
                    const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                    return `  ${ctx.label}: ${euroFull(val)} (${pct}%)`;
                  },
                },
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
  }, [totalPaid, totalOpen, paidPercent, total]);

  if (total === 0) {
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
      <div style={{ position: "relative", height: 280 }}>
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
