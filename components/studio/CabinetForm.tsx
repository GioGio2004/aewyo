"use client";

import T from "@/components/landing/T";
import { copy } from "@/components/landing/copy";
import type { LocalizedString } from "@/components/landing/copy";
import { DECORS } from "@/lib/cabinet/decors";
import { LIMITS } from "@/lib/cabinet/solve";
import type {
  CabinetParams,
  FrontType,
  ValidationError,
} from "@/lib/cabinet/types";

type NumberKey = {
  [K in keyof CabinetParams]-?: CabinetParams[K] extends number ? K : never;
}[keyof CabinetParams];

type NumberField = { key: NumberKey; label: LocalizedString; step: number };

const DIMENSION_FIELDS: NumberField[] = [
  { key: "width", label: copy.studio.fields.width, step: 10 },
  { key: "height", label: copy.studio.fields.height, step: 10 },
  { key: "depth", label: copy.studio.fields.depth, step: 10 },
  { key: "thickness", label: copy.studio.fields.thickness, step: 1 },
  { key: "backThickness", label: copy.studio.fields.backThickness, step: 1 },
  { key: "shelfCount", label: copy.studio.fields.shelfCount, step: 1 },
  { key: "plinthHeight", label: copy.studio.fields.plinthHeight, step: 10 },
  { key: "shelfSetback", label: copy.studio.fields.shelfSetback, step: 5 },
];

const FRONT_TYPES: Array<{ value: FrontType; label: LocalizedString }> = [
  { value: "none", label: copy.studio.front.none },
  { value: "doors", label: copy.studio.front.doors },
  { value: "drawers", label: copy.studio.front.drawers },
];

const fieldLabel =
  "mb-1.5 block text-[13px] font-medium text-[var(--aw-muted)]";
const inputCls =
  "h-10 w-full rounded-md border border-[var(--aw-line)] bg-white px-3 text-[15px] tabular-nums text-[var(--aw-ink)] aria-[invalid=true]:border-[#9B3B2E]";

export default function CabinetForm({
  params,
  errors,
  onChange,
}: {
  params: CabinetParams;
  errors: ValidationError[];
  onChange: (params: CabinetParams) => void;
}) {
  const setNumber = (key: NumberKey, raw: string) => {
    onChange({ ...params, [key]: raw === "" ? NaN : Number(raw) });
  };

  const numberInput = ({ key, label, step }: NumberField) => (
    <label key={key} className="block">
      <span className={fieldLabel}>
        <T s={label} />
        {key !== "shelfCount" &&
          key !== "doorCount" &&
          key !== "drawerCount" && (
            <span className="text-[var(--aw-muted)]"> · mm</span>
          )}
      </span>
      <input
        type="number"
        inputMode="numeric"
        value={Number.isNaN(params[key]) ? "" : params[key]}
        step={step}
        min={LIMITS[key].min}
        max={LIMITS[key].max}
        onChange={(e) => setNumber(key, e.target.value)}
        aria-invalid={errors.some((er) => er.field === key)}
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
        onChange={(e) => onChange({ ...params, [key]: e.target.value })}
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
    <div>
      <div className="grid grid-cols-2 gap-4">
        {DIMENSION_FIELDS.filter(
          ({ key }) =>
            !(
              params.front === "drawers" &&
              (key === "shelfCount" || key === "shelfSetback")
            ),
        ).map(numberInput)}
      </div>

      <div className="mt-6 space-y-4">
        <div
          className="grid grid-cols-3 overflow-hidden rounded-md border border-[var(--aw-line)]"
          role="group"
        >
          {FRONT_TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ ...params, front: value })}
              aria-pressed={params.front === value}
              className={`h-10 text-[13px] font-medium transition-colors ${
                params.front === value
                  ? "bg-[var(--aw-ink)] text-[var(--aw-paper)]"
                  : "bg-white text-[var(--aw-muted)] hover:text-[var(--aw-ink)]"
              }`}
            >
              <T s={label} />
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {params.front === "doors" &&
            numberInput({
              key: "doorCount",
              label: copy.studio.front.doorCount,
              step: 1,
            })}
          {params.front === "drawers" &&
            numberInput({
              key: "drawerCount",
              label: copy.studio.front.drawerCount,
              step: 1,
            })}
          {params.front !== "none" &&
            numberInput({
              key: "reveal",
              label: copy.studio.front.reveal,
              step: 1,
            })}
          {decorSelect("carcassDecor", copy.studio.front.carcassDecor)}
          {params.front !== "none" &&
            decorSelect("frontDecor", copy.studio.front.frontDecor)}
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="mt-5 space-y-2 text-[13px] leading-5 text-[#9B3B2E]">
          {errors.map((error, i) => (
            <li key={`${error.field}-${i}`}>
              <T s={error.message} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
