"use client";

import { toRoom, wallFrames } from "@/lib/kitchen/layout";
import type {
  KitchenLayout,
  KitchenProject,
  PlacedCabinet,
} from "@/lib/kitchen/types";
import type { Appliance } from "@/lib/cabinet/types";

// Top-down plan sheet. Room space: x right, z down (into the room from the
// first wall). Walls are drawn as a solid band on their outside, cabinets
// at their world position, and every wall carries a dimension chain of the
// floor run plus its total length beyond the band.

const INK = "#1C1917";
const WALNUT = "#5E4634";
const MUTED = "#78716C";
const HAIRLINE = "#E7E3DC";
const PAPER = "#FAF9F6";
const TINT = "#EFE8DD";
const COUNTER = "#F4F1EA";

const VIEW_W = 720;
/** Room for the wall band + two dimension chains + wall marker (px) */
const MARGIN = 88;
/** Drawn wall thickness (mm) */
const WALL_T = 100;
/** Offsets beyond the band's outer edge (px) */
const CHAIN_1 = 18;
const CHAIN_2 = 40;
const MARKER = 62;

const deg = (rad: number) => (rad * 180) / Math.PI;
const fmt = (v: number) => String(Math.round(v));

type Seg = { from: number; to: number; free?: boolean };

/**
 * Floor-run chain of a wall: every base/tall item (incl. spacers and the
 * legs of corner cabinets touching this wall) in wall order, with the
 * start offset / gaps / free space filled in as "free" segments.
 */
function floorSegments(
  layout: KitchenLayout,
  wallId: string,
  wallLength: number,
): Seg[] {
  const items: Seg[] = [];
  for (const c of layout.cabinets) {
    const p = c.placement;
    if (p.kind === "corner") {
      const k = c.corner;
      if (!k || p.band === "wall") continue;
      if (k.wallA === wallId) items.push({ from: c.runPos, to: c.runPos + k.legA });
      else if (k.wallB === wallId) items.push({ from: 0, to: k.legB });
      continue;
    }
    if (p.wallId !== wallId || p.band === "wall") continue;
    items.push({ from: c.runPos, to: c.runPos + p.params.width });
  }
  items.sort((a, b) => a.from - b.from);
  const out: Seg[] = [];
  let cursor = 0;
  for (const it of items) {
    if (it.from - cursor > 0.5) out.push({ from: cursor, to: it.from, free: true });
    out.push(it);
    cursor = Math.max(cursor, it.to);
  }
  if (wallLength - cursor > 0.5) out.push({ from: cursor, to: wallLength, free: true });
  return out;
}

/** 45° architectural tick centred on (x, y) */
function Tick({ x, y }: { x: number; y: number }) {
  return <line x1={x - 2.5} y1={y + 2.5} x2={x + 2.5} y2={y - 2.5} />;
}

/** Arrow head pointing along (ux, uy) with its tip at (x, y) */
function arrowPath(x: number, y: number, ux: number, uy: number): string {
  const px = -uy;
  const py = ux;
  const bx = x - ux * 6;
  const by = y - uy * 6;
  return `M${bx + px * 3} ${by + py * 3} L${x} ${y} L${bx - px * 3} ${by - py * 3}`;
}

/**
 * Dimension label placed on the far side (−y) of a horizontal line at
 * yLine in a wall-local group. `flip` keeps the text readable when the
 * group is rotated past 90°.
 */
function ChainLabel({
  x,
  yLine,
  flip,
  color,
  children,
}: {
  x: number;
  yLine: number;
  flip: boolean;
  color: string;
  children: React.ReactNode;
}) {
  const y = flip ? yLine - 12 : yLine - 4;
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={10}
      fill={color}
      letterSpacing="0.05em"
      transform={flip ? `rotate(180 ${x} ${y})` : undefined}
    >
      {children}
    </text>
  );
}

/** Appliance symbol in cabinet-local plan coordinates (x along, y = depth) */
function PlanAppliance({
  kind,
  w,
  d,
  s,
}: {
  kind: Appliance;
  w: number;
  d: number;
  s: number;
}) {
  const g = { stroke: INK, strokeOpacity: 0.6, strokeWidth: 0.8, fill: "none" };
  switch (kind) {
    case "sink": {
      const rimX = 40 * s;
      const rimZ = 60 * s;
      return (
        <g {...g}>
          <rect
            x={rimX}
            y={rimZ}
            width={(w - 80) * s}
            height={(d - 120) * s}
            rx={20 * s}
          />
          <rect
            x={rimX + 30 * s}
            y={rimZ + 30 * s}
            width={(w - 140) * s}
            height={(d - 180) * s}
            rx={14 * s}
          />
          <circle cx={(w / 2) * s} cy={35 * s} r={14 * s} fill={INK} fillOpacity={0.5} stroke="none" />
        </g>
      );
    }
    case "hob": {
      const cx = (w / 2) * s;
      const cy = (d / 2) * s;
      const dx = w * 0.22 * s;
      const dz = d * 0.22 * s;
      const r = Math.min(w, d) * 0.13 * s;
      return (
        <g {...g}>
          <rect x={30 * s} y={30 * s} width={(w - 60) * s} height={(d - 60) * s} strokeOpacity={0.3} strokeWidth={0.5} />
          <circle cx={cx - dx} cy={cy - dz} r={r} />
          <circle cx={cx + dx} cy={cy - dz} r={r} />
          <circle cx={cx - dx} cy={cy + dz} r={r} />
          <circle cx={cx + dx} cy={cy + dz} r={r} />
        </g>
      );
    }
    case "oven":
      return (
        <g {...g}>
          <line x1={20 * s} y1={(d - 40) * s} x2={(w - 20) * s} y2={(d - 40) * s} />
        </g>
      );
    case "fridge":
      return (
        <g {...g}>
          <rect x={15 * s} y={15 * s} width={(w - 30) * s} height={(d - 30) * s} />
          <line x1={15 * s} y1={(d - 60) * s} x2={(w - 15) * s} y2={(d - 60) * s} />
          <line x1={(w - 70) * s} y1={(d - 60) * s} x2={(w - 70) * s} y2={(d - 20) * s} strokeWidth={1.4} />
        </g>
      );
    case "hood":
      return (
        <g {...g}>
          <rect x={30 * s} y={30 * s} width={(w - 60) * s} height={(d - 60) * s} strokeDasharray="3 2" />
        </g>
      );
    default:
      return null;
  }
}

export default function PlanView({
  project,
  layout,
  selectedId,
  onSelect,
}: {
  project: KitchenProject;
  layout: KitchenLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const frames = wallFrames(project);
  const { bounds } = layout;
  const spanX = Math.max(bounds.maxX - bounds.minX, 1500);
  const spanZ = Math.max(bounds.maxZ - bounds.minZ, 1000);
  const s = Math.min((VIEW_W - 2 * MARGIN) / spanX, 420 / spanZ);
  const ox = MARGIN - bounds.minX * s;
  const oy = MARGIN - bounds.minZ * s;
  const H = spanZ * s + 2 * MARGIN;
  const X = (x: number) => ox + x * s;
  const Y = (z: number) => oy + z * s;
  const T = WALL_T * s;

  // draw wall-band cabinets last so their dashed outline stays visible
  const ordered = [...layout.cabinets].sort((a, b) =>
    a.placement.band === "wall" ? 1 : b.placement.band === "wall" ? -1 : 0,
  );

  const strokeFor = (cabinet: PlacedCabinet, selected: boolean) => {
    const p = cabinet.placement;
    const spacer = p.kind === "spacer";
    return {
      fill: spacer
        ? "none"
        : p.band === "wall"
          ? "none"
          : p.band === "tall"
            ? TINT
            : "#FFFFFF",
      stroke: selected ? WALNUT : INK,
      strokeOpacity: selected ? 1 : spacer ? 0.35 : p.band === "wall" ? 0.5 : 0.55,
      strokeWidth: selected ? 2 : 1,
      strokeDasharray: spacer ? "3 3" : p.band === "wall" ? "4 3" : undefined,
    };
  };

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Kitchen plan"
      onClick={() => onSelect(null)}
    >
      {/* wall bands (fills first, contour lines on top) */}
      {project.walls.map((wall, i) => {
        const f = frames.get(wall.id)!;
        const o = f.origin;
        const n = f.normal;
        const dir = f.dir;
        const e = { x: o.x + dir.x * wall.length, z: o.z + dir.z * wall.length };
        const last = i === project.walls.length - 1;
        const turn = last ? undefined : (wall.turn ?? "right");
        const prevTurn = i > 0 ? (project.walls[i - 1].turn ?? "right") : undefined;
        // fill extends over the corner square at inside corners and yields
        // it to the next wall at outside corners so the bands tile
        const f1 = turn === "right" ? WALL_T : turn === "left" ? -WALL_T : 0;
        const a0 = prevTurn === "right" ? -WALL_T : prevTurn === "left" ? WALL_T : 0;
        const a1 = f1;
        const P = (t: number, out: number) => ({
          x: X(o.x + dir.x * t - n.x * out),
          y: Y(o.z + dir.z * t - n.z * out),
        });
        const c0 = P(0, 0);
        const c1 = P(wall.length + f1, 0);
        const c2 = P(wall.length + f1, WALL_T);
        const c3 = P(0, WALL_T);
        const o0 = P(a0, WALL_T);
        const o1 = P(wall.length + a1, WALL_T);
        return (
          <g key={`band-${wall.id}`}>
            <polygon
              points={`${c0.x},${c0.y} ${c1.x},${c1.y} ${c2.x},${c2.y} ${c3.x},${c3.y}`}
              fill={HAIRLINE}
              stroke="none"
            />
            <g stroke={INK} strokeOpacity={0.55} strokeWidth={1}>
              <line x1={X(o.x)} y1={Y(o.z)} x2={X(e.x)} y2={Y(e.z)} />
              <line x1={o0.x} y1={o0.y} x2={o1.x} y2={o1.y} />
              {i === 0 && <line x1={c0.x} y1={c0.y} x2={c3.x} y2={c3.y} />}
              {last && <line x1={X(e.x)} y1={Y(e.z)} x2={o1.x} y2={o1.y} />}
            </g>
          </g>
        );
      })}

      {/* countertops under the cabinets */}
      {layout.counters.map((c, i) => (
        <rect
          key={`counter-${i}`}
          x={X(c.position.x - c.size.x / 2)}
          y={Y(c.position.z - c.size.z / 2)}
          width={c.size.x * s}
          height={c.size.z * s}
          fill={COUNTER}
          stroke={INK}
          strokeOpacity={0.3}
          strokeWidth={0.5}
        />
      ))}

      {/* cabinets */}
      {ordered.map((cabinet) => {
        const p = cabinet.placement;
        const selected = p.id === selectedId;
        const style = strokeFor(cabinet, selected);
        const angle = -deg(cabinet.world.rotY);
        const gx = X(cabinet.world.x);
        const gy = Y(cabinet.world.z);
        const { width, depth } = p.params;
        const corner = p.kind === "corner" ? cabinet.corner : undefined;

        let labelAt: { x: number; y: number };
        if (corner && corner.footprint.length > 0) {
          const pts = corner.footprint;
          const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length;
          const cz = pts.reduce((a, q) => a + q[1], 0) / pts.length;
          const r = toRoom(cabinet, { x: cx, y: 0, z: cz });
          labelAt = { x: X(r.x), y: Y(r.z) };
        } else {
          const r = toRoom(cabinet, { x: width / 2, y: 0, z: depth / 2 });
          labelAt = { x: X(r.x), y: Y(r.z) };
        }

        return (
          <g
            key={p.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(p.id);
            }}
            style={{ cursor: "pointer" }}
          >
            <g transform={`translate(${gx} ${gy}) rotate(${angle})`}>
              {corner && corner.footprint.length > 0 ? (
                <polygon
                  points={corner.footprint
                    .map(([x, z]) => `${x * s},${z * s}`)
                    .join(" ")}
                  {...style}
                />
              ) : (
                <rect x={0} y={0} width={width * s} height={depth * s} {...style} />
              )}
              {p.params.appliance && p.kind !== "spacer" && !corner && (
                <PlanAppliance kind={p.params.appliance} w={width} d={depth} s={s} />
              )}
            </g>
            <text
              x={labelAt.x}
              y={labelAt.y + 3.5}
              textAnchor="middle"
              fontSize={10}
              fill={selected ? WALNUT : INK}
              fillOpacity={selected ? 1 : 0.65}
              letterSpacing="0.04em"
            >
              {p.label}
            </text>
          </g>
        );
      })}

      {/* dimension chains + wall markers, one rotated group per wall */}
      {project.walls.map((wall) => {
        const f = frames.get(wall.id)!;
        const angle = deg(Math.atan2(f.dir.z, f.dir.x));
        const flip = angle >= 90 || angle < -90;
        const L = wall.length * s;
        const y1 = -(T + CHAIN_1);
        const y2 = -(T + CHAIN_2);
        const yM = -(T + MARKER);
        const segs = floorSegments(layout, wall.id, wall.length);
        const edges = Array.from(
          new Set(segs.flatMap((g) => [g.from, g.to])),
        ).sort((a, b) => a - b);
        const chainFrom = Math.min(0, ...edges) * s;
        const chainTo = Math.max(wall.length, ...edges) * s;
        return (
          <g
            key={`dim-${wall.id}`}
            transform={`translate(${X(f.origin.x)} ${Y(f.origin.z)}) rotate(${angle})`}
          >
            <g stroke={INK} strokeOpacity={0.45} strokeWidth={0.8} fill="none">
              {/* extension lines from the band to the chain */}
              {edges.map((t) => (
                <line
                  key={`ext-${t}`}
                  x1={t * s}
                  y1={-T - 3}
                  x2={t * s}
                  y2={y1 - 3}
                />
              ))}
              {/* run chain */}
              {segs.length > 0 && (
                <line x1={chainFrom} y1={y1} x2={chainTo} y2={y1} />
              )}
              {edges.map((t) => (
                <Tick key={`tick-${t}`} x={t * s} y={y1} />
              ))}
              {/* total length */}
              <line x1={0} y1={-T - 3} x2={0} y2={y2 - 3} />
              <line x1={L} y1={-T - 3} x2={L} y2={y2 - 3} />
              <line x1={0} y1={y2} x2={L} y2={y2} />
              <path d={arrowPath(0, y2, -1, 0)} />
              <path d={arrowPath(L, y2, 1, 0)} />
            </g>
            {segs.map((g, i) => {
              const px = (g.to - g.from) * s;
              if (px < 12) return null;
              return (
                <ChainLabel
                  key={`lbl-${i}`}
                  x={((g.from + g.to) / 2) * s}
                  yLine={y1}
                  flip={flip}
                  color={g.free ? MUTED : WALNUT}
                >
                  {fmt(g.to - g.from)}
                </ChainLabel>
              );
            })}
            <ChainLabel x={L / 2} yLine={y2} flip={flip} color={WALNUT}>
              {fmt(wall.length)}
            </ChainLabel>
            {/* wall marker */}
            <g transform={`rotate(${-angle} ${L / 2} ${yM})`}>
              <circle
                cx={L / 2}
                cy={yM}
                r={8}
                fill={PAPER}
                stroke={INK}
                strokeOpacity={0.55}
                strokeWidth={1}
              />
              <text
                x={L / 2}
                y={yM + 3.5}
                textAnchor="middle"
                fontSize={10}
                fill={INK}
                fillOpacity={0.75}
                letterSpacing="0.04em"
              >
                {wall.id}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
