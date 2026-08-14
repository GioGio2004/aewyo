"use client";

import { wallFrames } from "@/lib/kitchen/layout";
import type { KitchenLayout, KitchenProject } from "@/lib/kitchen/types";

const INK = "#1C1917";
const WALNUT = "#5E4634";

// Top-down plan: x = along wall A, y = into the room (room z).
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
  const spanZ = Math.max(bounds.maxZ - bounds.minZ, 1200);
  const s = Math.min(600 / spanX, 400 / spanZ);
  const ox = 24 - bounds.minX * s;
  const oy = 24 - bounds.minZ * s;
  const H = spanZ * s + 56;

  const rectFor = (id: string) => {
    const cabinet = layout.cabinets.find((c) => c.placement.id === id)!;
    const f = frames.get(cabinet.placement.wallId)!;
    const { width, depth } = cabinet.placement.params;
    const x0 = cabinet.world.x;
    const z0 = cabinet.world.z;
    const x1 = x0 + f.dir.x * width + f.normal.x * depth;
    const z1 = z0 + f.dir.z * width + f.normal.z * depth;
    return {
      x: ox + Math.min(x0, x1) * s,
      y: oy + Math.min(z0, z1) * s,
      w: Math.abs(x1 - x0) * s,
      h: Math.abs(z1 - z0) * s,
    };
  };

  const bandStyle = (band: string, spacer: boolean, selected: boolean) => ({
    fill: spacer
      ? "none"
      : band === "tall"
        ? "#EFE8DD"
        : band === "wall"
          ? "none"
          : "#FFFFFF",
    stroke: selected ? WALNUT : INK,
    strokeOpacity: selected ? 1 : spacer ? 0.35 : 0.5,
    strokeWidth: selected ? 2 : 1,
    strokeDasharray: spacer || band === "wall" ? "4 3" : undefined,
  });

  // draw wall-band cabinets last so their dashed outline stays visible
  const ordered = [...layout.cabinets].sort((a, b) =>
    a.placement.band === "wall" ? 1 : b.placement.band === "wall" ? -1 : 0,
  );

  return (
    <svg
      viewBox={`0 0 648 ${H}`}
      className="w-full"
      role="img"
      aria-label="Kitchen plan"
      onClick={() => onSelect(null)}
    >
      {/* walls */}
      {project.walls.map((wall) => {
        const f = frames.get(wall.id)!;
        const x0 = ox + (f.origin.x - f.normal.x * 6) * s;
        const y0 = oy + (f.origin.z - f.normal.z * 6) * s;
        const x1 = x0 + f.dir.x * wall.length * s;
        const y1 = y0 + f.dir.z * wall.length * s;
        return (
          <g key={wall.id}>
            <line
              x1={x0}
              y1={y0}
              x2={x1}
              y2={y1}
              stroke={INK}
              strokeOpacity={0.7}
              strokeWidth={5}
            />
            <text
              x={(x0 + x1) / 2 + f.normal.x * 14 - 4}
              y={(y0 + y1) / 2 + f.normal.z * 14 + 4}
              fontSize={11}
              fill={INK}
              fillOpacity={0.45}
            >
              {wall.id}
            </text>
          </g>
        );
      })}

      {/* cabinets */}
      {ordered.map((cabinet) => {
        const r = rectFor(cabinet.placement.id);
        const selected = cabinet.placement.id === selectedId;
        const style = bandStyle(
          cabinet.placement.band,
          cabinet.placement.kind === "spacer",
          selected,
        );
        return (
          <g
            key={cabinet.placement.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(cabinet.placement.id);
            }}
            style={{ cursor: "pointer" }}
          >
            <rect x={r.x} y={r.y} width={r.w} height={r.h} {...style} />
            <text
              x={r.x + r.w / 2}
              y={r.y + r.h / 2 + 4}
              textAnchor="middle"
              fontSize={11}
              fill={selected ? WALNUT : INK}
              fillOpacity={selected ? 1 : 0.6}
              letterSpacing="0.04em"
            >
              {cabinet.placement.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
