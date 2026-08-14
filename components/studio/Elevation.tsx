import type { CabinetParams, Panel } from "@/lib/cabinet/types";

// Front elevation projected straight from the solved panels, in the same
// drafting style as the landing blueprint. Screen y is flipped (SVG is
// top-down, cabinet y is bottom-up). Carcass lines fade to hidden-line
// weight when fronts cover them.
const VIEW_W = 460;
const VIEW_H = 560;
const FIT_W = 340;
const FIT_H = 460;

const INK = "#1C1917";
const WALNUT = "#5E4634";

const HIDDEN_ROLES = new Set(["back", "drawer-side", "drawer-rail", "drawer-bottom"]);
const FRONT_ROLES = new Set(["door", "drawer-front"]);

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export default function Elevation({
  panels,
  params,
}: {
  panels: Panel[];
  params: CabinetParams;
}) {
  const s = Math.min(FIT_W / params.width, FIT_H / params.height);
  const w = params.width * s;
  const h = params.height * s;
  const ox = (VIEW_W - w) / 2;
  const oy = 36;

  // cabinet-space rect -> screen-space rect for the front view
  const rect = (panel: Panel) => ({
    x: ox + (panel.position.x - panel.size.x / 2) * s,
    y: oy + (params.height - (panel.position.y + panel.size.y / 2)) * s,
    w: panel.size.x * s,
    h: panel.size.y * s,
  });

  const carcass = panels.filter(
    (p) => !HIDDEN_ROLES.has(p.role) && !FRONT_ROLES.has(p.role),
  );
  const fronts = panels.filter((p) => FRONT_ROLES.has(p.role));
  const hasFronts = fronts.length > 0;

  const shelves = panels.filter((p) => p.role === "shelf");
  const firstShelf = shelves[0];
  const bottom = panels.find((p) => p.role === "bottom");
  // clear opening between the bottom and the first shelf
  const gapDim =
    firstShelf && bottom
      ? {
          from:
            oy +
            (params.height -
              (firstShelf.position.y - firstShelf.size.y / 2)) *
              s,
          to: oy + (params.height - (bottom.position.y + bottom.size.y / 2)) * s,
          value:
            firstShelf.position.y -
            firstShelf.size.y / 2 -
            (bottom.position.y + bottom.size.y / 2),
        }
      : null;

  const dimY = oy + h + 30;
  const dimX = ox + w + 30;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="w-full max-w-[460px]"
      role="img"
      aria-label="Front elevation"
    >
      {/* carcass (hidden-line weight when covered by fronts) */}
      <g
        stroke={INK}
        strokeOpacity={hasFronts ? 0.28 : 0.55}
        strokeWidth={1}
        fill="none"
      >
        {carcass.map((panel) => {
          const r = rect(panel);
          return (
            <rect
              key={panel.id}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              strokeDasharray={hasFronts ? "3 3" : undefined}
              strokeOpacity={panel.role === "plinth" ? 0.35 : undefined}
            />
          );
        })}
      </g>

      {/* fronts */}
      <g stroke={INK} strokeOpacity={0.6} strokeWidth={1} fill="none">
        {fronts.map((panel) => {
          const r = rect(panel);
          return (
            <rect key={panel.id} x={r.x} y={r.y} width={r.w} height={r.h} />
          );
        })}
      </g>

      {/* dimensions */}
      <g stroke={INK} strokeOpacity={0.4} strokeWidth={1} fill="none">
        {/* overall width */}
        <line x1={ox} y1={oy + h + 6} x2={ox} y2={dimY + 8} />
        <line x1={ox + w} y1={oy + h + 6} x2={ox + w} y2={dimY + 8} />
        <line x1={ox + 4} y1={dimY} x2={ox + w - 4} y2={dimY} />
        <path d={`M${ox + 10} ${dimY - 3} L${ox + 4} ${dimY} L${ox + 10} ${dimY + 3}`} />
        <path d={`M${ox + w - 10} ${dimY - 3} L${ox + w - 4} ${dimY} L${ox + w - 10} ${dimY + 3}`} />
        {/* overall height */}
        <line x1={ox + w + 6} y1={oy} x2={dimX + 8} y2={oy} />
        <line x1={ox + w + 6} y1={oy + h} x2={dimX + 8} y2={oy + h} />
        <line x1={dimX} y1={oy + 4} x2={dimX} y2={oy + h - 4} />
        <path d={`M${dimX - 3} ${oy + 10} L${dimX} ${oy + 4} L${dimX + 3} ${oy + 10}`} />
        <path d={`M${dimX - 3} ${oy + h - 10} L${dimX} ${oy + h - 4} L${dimX + 3} ${oy + h - 10}`} />
        {/* clear opening between bottom and first shelf */}
        {gapDim && (
          <>
            <line x1={ox - 6} y1={gapDim.from} x2={ox - 34} y2={gapDim.from} />
            <line x1={ox - 6} y1={gapDim.to} x2={ox - 34} y2={gapDim.to} />
            <line x1={ox - 28} y1={gapDim.from + 4} x2={ox - 28} y2={gapDim.to - 4} />
            <path d={`M${ox - 31} ${gapDim.from + 10} L${ox - 28} ${gapDim.from + 4} L${ox - 25} ${gapDim.from + 10}`} />
            <path d={`M${ox - 31} ${gapDim.to - 10} L${ox - 28} ${gapDim.to - 4} L${ox - 25} ${gapDim.to - 10}`} />
          </>
        )}
      </g>

      {/* labels */}
      <g fill={WALNUT} fontSize={11} letterSpacing="0.06em">
        <text x={ox + w / 2} y={dimY - 6} textAnchor="middle">
          {fmt(params.width)}
        </text>
        <text
          x={dimX - 6}
          y={oy + h / 2}
          textAnchor="middle"
          transform={`rotate(-90 ${dimX - 6} ${oy + h / 2})`}
        >
          {fmt(params.height)}
        </text>
        {gapDim && (
          <text
            x={ox - 34}
            y={(gapDim.from + gapDim.to) / 2}
            textAnchor="middle"
            transform={`rotate(-90 ${ox - 34} ${(gapDim.from + gapDim.to) / 2})`}
          >
            {fmt(gapDim.value)}
          </text>
        )}
      </g>
    </svg>
  );
}
