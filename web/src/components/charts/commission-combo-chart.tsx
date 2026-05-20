"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import { Chart } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
);

interface CommissionComboChartProps {
  labels: string[];
  monthly: number[];
  cumulative: number[];
}

function euroK(value: number): string {
  return `€${(value / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })}K`;
}

export function CommissionComboChart({ labels, monthly, cumulative }: CommissionComboChartProps) {
  const data = {
    labels,
    datasets: [
      {
        type: "bar" as const,
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
        type: "line" as const,
        label: "Kumuliert",
        data: cumulative,
        borderColor: "#22c55e",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: "#22c55e",
        tension: 0.3,
        fill: false,
        yAxisID: "yRight",
        order: 1,
      },
    ],
  };

  const options: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "#a3a3a3",
          boxWidth: 12,
          padding: 16,
          font: { size: 12 },
        },
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
            const val = ctx.parsed.y as number;
            const formatted = new Intl.NumberFormat("de-DE", {
              style: "currency",
              currency: "EUR",
            }).format(val);
            return ` ${ctx.dataset.label}: ${formatted}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "#737373", font: { size: 11 } },
        grid: { color: "rgba(255,255,255,0.04)" },
        border: { color: "#333" },
      },
      yLeft: {
        type: "linear",
        position: "left",
        ticks: {
          color: "#737373",
          font: { size: 11 },
          callback: (v) => euroK(Number(v)),
        },
        grid: { color: "rgba(255,255,255,0.06)" },
        border: { color: "#333" },
      },
      yRight: {
        type: "linear",
        position: "right",
        ticks: {
          color: "#22c55e",
          font: { size: 11 },
          callback: (v) => euroK(Number(v)),
        },
        grid: { drawOnChartArea: false },
        border: { color: "#333" },
      },
    },
  };

  return (
    <div className="metric-card" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <p className="mb-4 text-sm font-semibold text-white">Provisionsübersicht</p>
      <div style={{ height: 280 }}>
        <Chart type="bar" data={data} options={options} />
      </div>
    </div>
  );
}
