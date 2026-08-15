import { clampCorner } from "@/lib/kitchen/corner";
import type { PlacedCabinet } from "@/lib/kitchen/types";

const VIEW_W = 460;
const VIEW_H = 460;
const INK = "#1C1917";
const WALNUT = "#5E4634";

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export default function CornerDrawing({
  cabinet,
}: {
  cabinet: PlacedCabinet;
}) {
  const p = cabinet.placement;
  const corner = p.corner;
  if (!corner) return null;

  const clamped = clampCorner(p.params, corner);
  const { legA, legB, style } = clamped;
  const depth = p.params.depth;
  const height = p.params.height;

  // Max span calculation for scale
  const maxSpan = Math.max(legA, legB) + 160;
  const s = Math.min(300 / maxSpan, 300 / maxSpan);

  const ox = 80;
  const oy = 80;

  const toScreen = ([x, z]: [number, number]): [number, number] => [
    ox + x * s,
    oy + z * s,
  ];

  const footprint =
    cabinet.corner?.footprint && cabinet.corner.footprint.length > 0
      ? cabinet.corner.footprint
      : style === "diagonal"
        ? ([
            [0, 0],
            [legB, 0],
            [legB, depth],
            [depth, legA],
            [0, legA],
          ] as Array<[number, number]>)
        : ([
            [0, 0],
            [depth, 0],
            [depth, legA],
            [0, legA],
          ] as Array<[number, number]>);

  const pts = footprint.map(toScreen);
  const polyStr = pts.map(([x, y]) => `${x},${y}`).join(" ");

  // Dimension positions
  const dimTopY = oy - 24;
  const dimLeftX = ox - 24;

  const wallAEnd = oy + legA * s;
  const wallBEnd = ox + legB * s;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="w-full max-w-[460px]"
      role="img"
      aria-label="Corner cabinet drawing"
    >
      {/* Wall guide lines */}
      <g stroke={INK} strokeOpacity={0.3} strokeWidth={2}>
        {/* Wall A (vertical) */}
        <line x1={ox} y1={oy - 20} x2={ox} y2={wallAEnd + 30} />
        {/* Wall B (horizontal) */}
        <line x1={ox - 20} y1={oy} x2={wallBEnd + 30} y2={oy} />
      </g>

      {/* Wall A & Wall B names */}
      <text
        x={ox - 10}
        y={oy + (legA * s) / 2}
        fontSize={11}
        fill={INK}
        fillOpacity={0.6}
        textAnchor="end"
      >
        {cabinet.corner?.wallA ?? p.wallId}
      </text>
      <text
        x={ox + (legB * s) / 2}
        y={oy - 8}
        fontSize={11}
        fill={INK}
        fillOpacity={0.6}
        textAnchor="middle"
      >
        {cabinet.corner?.wallB ?? "B"}
      </text>

      {/* Cabinet Footprint outline */}
      <polygon
        points={polyStr}
        fill="#FAF9F6"
        stroke={WALNUT}
        strokeWidth={2}
      />

      {/* Front door / diagonal line highlight */}
      {style === "diagonal" ? (
        <line
          x1={ox + legB * s}
          y1={oy + depth * s}
          x2={ox + depth * s}
          y2={oy + legA * s}
          stroke={WALNUT}
          strokeWidth={3}
        />
      ) : (
        <line
          x1={ox + depth * s}
          y1={oy + legB * s}
          x2={ox + depth * s}
          y2={oy + legA * s}
          stroke={WALNUT}
          strokeWidth={3}
        />
      )}

      {/* Dimension Lines */}
      <g stroke={INK} strokeOpacity={0.4} strokeWidth={1} fill="none">
        {/* legB (top horizontal) */}
        <line x1={ox} y1={oy - 6} x2={ox} y2={dimTopY - 6} />
        <line x1={wallBEnd} y1={oy - 6} x2={wallBEnd} y2={dimTopY - 6} />
        <line x1={ox + 4} y1={dimTopY} x2={wallBEnd - 4} y2={dimTopY} />
        <path
          d={`M${ox + 8} ${dimTopY - 3} L${ox + 4} ${dimTopY} L${ox + 8} ${dimTopY + 3}`}
        />
        <path
          d={`M${wallBEnd - 8} ${dimTopY - 3} L${wallBEnd - 4} ${dimTopY} L${wallBEnd - 8} ${dimTopY + 3}`}
        />

        {/* legA (left vertical) */}
        <line x1={ox - 6} y1={oy} x2={dimLeftX - 6} y2={oy} />
        <line x1={ox - 6} y1={wallAEnd} x2={dimLeftX - 6} y2={wallAEnd} />
        <line x1={dimLeftX} y1={oy + 4} x2={dimLeftX} y2={wallAEnd - 4} />
        <path
          d={`M${dimLeftX - 3} ${oy + 8} L${dimLeftX} ${oy + 4} L${dimLeftX + 3} ${oy + 8}`}
        />
        <path
          d={`M${dimLeftX - 3} ${wallAEnd - 8} L${dimLeftX} ${wallAEnd - 4} L${dimLeftX + 3} ${wallAEnd - 8}`}
        />
      </g>

      {/* Dimension text */}
      <g fill={WALNUT} fontSize={11} letterSpacing="0.06em">
        <text x={ox + (legB * s) / 2} y={dimTopY - 6} textAnchor="middle">
          {fmt(legB)} mm
        </text>
        <text
          x={dimLeftX - 6}
          y={oy + (legA * s) / 2}
          textAnchor="middle"
          transform={`rotate(-90 ${dimLeftX - 6} ${oy + (legA * s) / 2})`}
        >
          {fmt(legA)} mm
        </text>
      </g>

      {/* Label and Info */}
      <g fill={INK} fontSize={11}>
        <text
          x={VIEW_W / 2}
          y={VIEW_H - 24}
          textAnchor="middle"
          fillOpacity={0.7}
        >
          {p.label} · {style === "diagonal" ? "Diagonal" : "Blind"} · H: {height}{" "}
          mm · D: {depth} mm
        </text>
      </g>
    </svg>
  );
}
