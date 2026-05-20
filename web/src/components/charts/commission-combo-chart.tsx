"use client";

import { useEffect, useRef } from "react";
import type { Chart as ChartType } from "chart.js";

interface CommissionComboChartProps {
  labels: string[];
  monthly: number[];
  cumulative: number[];
}

function euroK(value: number): string {
  return `€${(value / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })}K`;
}

function euroFull(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

export function CommissionComboChart({ labels, monthly, cumulative }: CommissionComboChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartType | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    void (async () => {
      const {
        Chart,
        CategoryScale,
        LinearScale,
        BarElement,
        LineElement,
        PointElement,
        Tooltip,
        Legend,
      } = await import("chart.js");

      if (cancelled || !canvasRef.current) return;

      Chart.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

      chartRef.current?.destroy();

      chartRef.current = new Chart(canvas, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              type: "bar",
              label: "Monatliche Provision",
              data: monthly,
              backgroundColor: "rgba(59, 130, 246, 0.7)",
              borderColor: "rgba(59, 130, 246, 1)",
              borderWidth: 1,
              borderRadius: 4,
              yAxisID: "yLeft",
              order: 2,
            },
            {
              type: "line",
              label: "Kumuliert",
              data: cumulative,
              borderColor: "#22c55e",
              backgroundColor: "rgba(34,197,94,0.1)",
              borderWidth: 2,
              pointRadius: 4,
              pointBackgroundColor: "#22c55e",
              tension: 0.3,
              fill: false,
              yAxisID: "yRight",
              order: 1,
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
            yLeft: {
              type: "linear",
              position: "left",
              ticks: { color: "#737373", font: { size: 11 }, callback: (v) => euroK(Number(v)) },
              grid: { color: "rgba(255,255,255,0.06)" },
            },
            yRight: {
              type: "linear",
              position: "right",
              ticks: { color: "#22c55e", font: { size: 11 }, callback: (v) => euroK(Number(v)) },
              grid: { drawOnChartArea: false },
            },
          },
        },
      });
    })();

    return () => {
      cancelled = true;
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [labels, monthly, cumulative]);

  if (labels.length === 0) {
    return (
      <div
        className="metric-card flex items-center justify-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", height: 340 }}
      >
        <p className="text-sm text-[var(--brand-text-muted)]">Keine Provisionsdaten vorhanden.</p>
      </div>
    );
  }

  return (
    <div
      className="metric-card"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="mb-4 text-sm font-semibold text-white">Provisionsübersicht</p>
      <div style={{ position: "relative", height: 280 }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
