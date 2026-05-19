"use client";

interface FlowNode {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  textColor?: string;
}

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

const NODES: FlowNode[] = [
  { id: "eingehend", label: "Eingehend", x: 60, y: 80, color: "#262626", textColor: "#737373" },
  { id: "offen", label: "Offen", x: 200, y: 80, color: "#ff6b00", textColor: "#fff" },
  { id: "in_bearbeitung", label: "In Bearbeitung", x: 360, y: 80, color: "#f59e0b", textColor: "#0a0a0a" },
  { id: "bezahlt", label: "Bezahlt", x: 520, y: 80, color: "#22c55e", textColor: "#0a0a0a" },
  { id: "storniert", label: "Storniert", x: 200, y: 180, color: "#ef4444", textColor: "#fff" },
];

const NODE_W = 110;
const NODE_H = 36;
const R = 6;

function nodeById(id: string) {
  return NODES.find((n) => n.id === id)!;
}

function arrowHead(x: number, y: number, dir: "right" | "down") {
  if (dir === "right") {
    return `M${x - 7},${y - 4} L${x},${y} L${x - 7},${y + 4}`;
  }
  return `M${x - 4},${y - 7} L${x},${y} L${x + 4},${y - 7}`;
}

function HorizontalEdge({
  from,
  to,
  label,
  dashed,
}: {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}) {
  const f = nodeById(from);
  const t = nodeById(to);
  const x1 = f.x + NODE_W / 2;
  const y1 = f.y + NODE_H / 2;
  const x2 = t.x - NODE_W / 2;
  const y2 = t.y + NODE_H / 2;
  const midX = (x1 + x2) / 2;
  const midY = y1;

  return (
    <g>
      <path
        d={`M${x1},${y1} L${x2},${y2}`}
        fill="none"
        stroke="#555"
        strokeDasharray={dashed ? "5,4" : undefined}
        strokeWidth={1.5}
      />
      <path d={arrowHead(x2, y2, "right")} fill="#555" stroke="none" />
      {label && (
        <text dominantBaseline="auto" fill="#737373" fontSize={9} textAnchor="middle" x={midX} y={midY - 5}>
          {label}
        </text>
      )}
    </g>
  );
}

function DownEdge({ from, to, label }: { from: string; to: string; label?: string }) {
  const f = nodeById(from);
  const t = nodeById(to);
  const x1 = f.x;
  const y1 = f.y + NODE_H / 2;
  const x2 = t.x;
  const y2 = t.y - NODE_H / 2;

  return (
    <g>
      <path
        d={`M${x1},${y1} L${x1},${y2 + 7} L${x2},${y2 + 7}`}
        fill="none"
        stroke="#ef4444"
        strokeDasharray="5,4"
        strokeWidth={1.5}
      />
      <path d={arrowHead(x2, y2 + 7, "right")} fill="#ef4444" stroke="none" />
      {label && (
        <text dominantBaseline="middle" fill="#ef4444" fontSize={9} textAnchor="middle" x={(x1 + x2) / 2} y={(y1 + y2) / 2 + 20}>
          {label}
        </text>
      )}
    </g>
  );
}

const EDGES: FlowEdge[] = [
  { from: "eingehend", to: "offen" },
  { from: "offen", to: "in_bearbeitung" },
  { from: "in_bearbeitung", to: "bezahlt", label: "CSV Export" },
];

export function CommissionFlowDiagram() {
  return (
    <div
      className="metric-card flex flex-col"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="mb-3 text-sm font-semibold text-white">Gesamter Provisionsablauf</p>
      <div className="overflow-x-auto">
        <svg
          style={{ display: "block", minWidth: 600 }}
          viewBox="0 0 650 230"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Edges (drawn before nodes so nodes sit on top) */}
          {EDGES.map((e) => (
            <HorizontalEdge dashed={e.dashed} from={e.from} key={`${e.from}-${e.to}`} label={e.label} to={e.to} />
          ))}
          <DownEdge from="offen" label="Abgebrochen" to="storniert" />

          {/* Nodes */}
          {NODES.map((node) => (
            <g key={node.id}>
              <rect
                fill={node.color}
                height={NODE_H}
                rx={R}
                ry={R}
                width={NODE_W}
                x={node.x - NODE_W / 2}
                y={node.y - NODE_H / 2}
              />
              <text
                dominantBaseline="middle"
                fill={node.textColor ?? "#fff"}
                fontSize={11}
                fontWeight={600}
                textAnchor="middle"
                x={node.x}
                y={node.y}
              >
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {[
          { label: "Offen", color: "#ff6b00" },
          { label: "In Bearbeitung", color: "#f59e0b" },
          { label: "Bezahlt", color: "#22c55e" },
          { label: "Storniert", color: "#ef4444" },
        ].map(({ label, color }) => (
          <div className="flex items-center gap-1.5" key={label}>
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            <span className="text-xs text-[var(--brand-text-muted)]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
