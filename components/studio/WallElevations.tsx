"use client";

import T from "@/components/landing/T";
import { copy } from "@/components/landing/copy";
import type { KitchenLayout, KitchenProject } from "@/lib/kitchen/types";

const INK = "#1C1917";
const WALNUT = "#5E4634";

// Straight-on view of each wall: cabinets at their run position and band
// height, with the wall length dimensioned below.
export default function WallElevations({
  project,
  layout,
  selectedId,
  onSelect,
  singleColumn = false,
}: {
  project: KitchenProject;
  layout: KitchenLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Force one wall per row (print layout) */
  singleColumn?: boolean;
}) {
  return (
    <div className={singleColumn ? "grid gap-10" : "grid gap-8 xl:grid-cols-2"}>
      {project.walls.map((wall) => {
        const ROOM_H = project.wallHeight;
        const cabinets = layout.cabinets.filter(
          (c) => c.placement.wallId === wall.id,
        );
        const s = Math.min(300 / wall.length, 110 / ROOM_H) * 2;
        const w = wall.length * s;
        const h = ROOM_H * s;
        const ox = 16;
        const oy = 10;
        const dimY = oy + h + 24;
        return (
          <div key={wall.id} className="min-w-0">
            <h3 className="text-[13px] font-medium uppercase tracking-[0.18em] text-[var(--aw-muted)]">
              <T s={copy.studio.kitchen.wall} /> {wall.id}
            </h3>
            <svg
              viewBox={`0 0 ${w + 32} ${dimY + 18}`}
              className="mt-3 w-full"
              role="img"
              aria-label={`Wall ${wall.id} elevation`}
            >
              {/* wall face + floor line */}
              <rect
                x={ox}
                y={oy}
                width={w}
                height={h}
                fill="none"
                stroke={INK}
                strokeOpacity={0.2}
              />
              <line
                x1={ox - 8}
                y1={oy + h}
                x2={ox + w + 8}
                y2={oy + h}
                stroke={INK}
                strokeOpacity={0.5}
              />
              {/* cabinets */}
              {cabinets.map((cabinet) => {
                const { width, height } = cabinet.placement.params;
                const x = ox + cabinet.runPos * s;
                const y = oy + (ROOM_H - cabinet.bandY - height) * s;
                const selected = cabinet.placement.id === selectedId;
                return (
                  <g
                    key={cabinet.placement.id}
                    onClick={() => onSelect(cabinet.placement.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={width * s}
                      height={height * s}
                      fill={
                        cabinet.placement.kind === "spacer"
                          ? "none"
                          : "#FFFFFF"
                      }
                      stroke={selected ? WALNUT : INK}
                      strokeOpacity={
                        selected
                          ? 1
                          : cabinet.placement.kind === "spacer"
                            ? 0.3
                            : 0.55
                      }
                      strokeWidth={selected ? 2 : 1}
                      strokeDasharray={
                        cabinet.placement.kind === "spacer" ? "4 3" : undefined
                      }
                    />
                    <text
                      x={x + (width * s) / 2}
                      y={y + (height * s) / 2 + 4}
                      textAnchor="middle"
                      fontSize={10}
                      fill={selected ? WALNUT : INK}
                      fillOpacity={selected ? 1 : 0.6}
                    >
                      {cabinet.placement.label}
                    </text>
                  </g>
                );
              })}
              {/* wall length dimension */}
              <line
                x1={ox}
                y1={dimY}
                x2={ox + w}
                y2={dimY}
                stroke={INK}
                strokeOpacity={0.4}
              />
              <line x1={ox} y1={dimY - 5} x2={ox} y2={dimY + 5} stroke={INK} strokeOpacity={0.4} />
              <line x1={ox + w} y1={dimY - 5} x2={ox + w} y2={dimY + 5} stroke={INK} strokeOpacity={0.4} />
              <text
                x={ox + w / 2}
                y={dimY + 14}
                textAnchor="middle"
                fontSize={10}
                fill={WALNUT}
                letterSpacing="0.06em"
              >
                {wall.length}
              </text>
            </svg>
          </div>
        );
      })}
    </div>
  );
}
