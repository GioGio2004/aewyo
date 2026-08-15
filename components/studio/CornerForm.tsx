"use client";

import T from "@/components/landing/T";
import { copy } from "@/components/landing/copy";
import type { LocalizedString } from "@/components/landing/copy";
import { DECORS } from "@/lib/cabinet/decors";
import type { CabinetParams } from "@/lib/cabinet/types";
import { WALL_STANDOFF } from "@/lib/kitchen/presets";
import type { CornerParams, CornerStyle } from "@/lib/kitchen/types";

const fieldLabel =
  "mb-1.5 block text-[13px] font-medium text-[var(--aw-muted)]";
const inputCls =
  "h-10 w-full rounded-md border border-[var(--aw-line)] bg-white px-3 text-[15px] tabular-nums text-[var(--aw-ink)] transition-colors focus:border-[var(--aw-walnut)] focus:outline-none";

const STYLES: Array<{ value: CornerStyle; label: LocalizedString }> = [
  { value: "diagonal", label: copy.studio.kitchen.diagonal },
  { value: "blind", label: copy.studio.kitchen.blind },
];

/** Measurements form for a corner cabinet (legs + style + carcass basics). */
export default function CornerForm({
  params,
  corner,
  band,
  wallA,
  wallB,
  onParams,
  onCorner,
}: {
  params: CabinetParams;
  corner: CornerParams;
  band: "base" | "wall";
  wallA: string;
  wallB: string;
  onParams: (params: CabinetParams) => void;
  onCorner: (corner: CornerParams) => void;
}) {
  const minLeg = WALL_STANDOFF + params.depth + 100;

  const num = (
    label: React.ReactNode,
    value: number,
    min: number,
    max: number,
    step: number,
    set: (n: number) => void,
  ) => (
    <label className="block">
      <span className={fieldLabel}>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={Number.isNaN(value) ? "" : value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n)) set(n);
        }}
        className={inputCls}
      />
    </label>
  );

  const decorSelect = (
    key: "carcassDecor" | "frontDecor",
    label: LocalizedString,
  ) => (
    <label className="block">
      <span className={fieldLabel}>
        <T s={label} />
      </span>
      <select
        value={params[key]}
        onChange={(e) => onParams({ ...params, [key]: e.target.value })}
        className={`${inputCls} appearance-none`}
      >
        {DECORS.map((decor) => (
          <option key={decor.id} value={decor.id}>
            {decor.name.ka} · {decor.name.en}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-5">
      <div
        className="grid grid-cols-2 overflow-hidden rounded-md border border-[var(--aw-line)]"
        role="group"
      >
        {STYLES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={corner.style === value}
            onClick={() =>
              onCorner(
                value === "blind"
                  ? {
                      style: value,
                      legA: Math.max(corner.legA, minLeg + 50),
                      legB: WALL_STANDOFF + params.depth + params.frontThickness + 2,
                    }
                  : {
                      style: value,
                      legA: Math.max(corner.legA, minLeg),
                      legB: Math.max(corner.legB, minLeg),
                    },
              )
            }
            className={`h-10 text-[13px] font-medium transition-colors ${
              corner.style === value
                ? "bg-[var(--aw-ink)] text-[var(--aw-paper)]"
                : "bg-white text-[var(--aw-muted)] hover:text-[var(--aw-ink)]"
            }`}
          >
            <T s={label} />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {num(
          <>
            <T s={copy.studio.kitchen.legA} /> {wallA} · mm
          </>,
          corner.legA,
          minLeg,
          2000,
          10,
          (legA) => onCorner({ ...corner, legA }),
        )}
        {num(
          <>
            <T s={copy.studio.kitchen.legB} /> {wallB} · mm
          </>,
          corner.legB,
          corner.style === "blind" ? WALL_STANDOFF + params.depth : minLeg,
          2000,
          10,
          (legB) => onCorner({ ...corner, legB }),
        )}
        {num(
          <>
            <T s={copy.studio.fields.height} /> · mm
          </>,
          params.height,
          300,
          2600,
          10,
          (height) => onParams({ ...params, height }),
        )}
        {num(
          <>
            <T s={copy.studio.fields.depth} /> · mm
          </>,
          params.depth,
          200,
          800,
          10,
          (depth) => onParams({ ...params, depth }),
        )}
        {num(
          <>
            <T s={copy.studio.fields.thickness} /> · mm
          </>,
          params.thickness,
          12,
          25,
          1,
          (thickness) => onParams({ ...params, thickness }),
        )}
        {num(
          <T s={copy.studio.fields.shelfCount} />,
          params.shelfCount,
          0,
          6,
          1,
          (shelfCount) => onParams({ ...params, shelfCount }),
        )}
        {band === "base" &&
          num(
            <>
              <T s={copy.studio.fields.plinthHeight} /> · mm
            </>,
            params.plinthHeight,
            0,
            200,
            10,
            (plinthHeight) => onParams({ ...params, plinthHeight }),
          )}
        {num(
          <>
            <T s={copy.studio.front.reveal} /> · mm
          </>,
          params.reveal,
          2,
          6,
          1,
          (reveal) => onParams({ ...params, reveal }),
        )}
        {decorSelect("carcassDecor", copy.studio.front.carcassDecor)}
        {decorSelect("frontDecor", copy.studio.front.frontDecor)}
      </div>
    </div>
  );
}
