"use client";

import { useMutation, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import T from "@/components/landing/T";
import { copy } from "@/components/landing/copy";
import { countHardware, validate } from "@/lib/cabinet/solve";
import type { CabinetParams, HardwareItem } from "@/lib/cabinet/types";
import { layoutKitchen } from "@/lib/kitchen/layout";
import {
  COUNTER_THICKNESS,
  DEFAULT_BAND_GAP,
  DEFAULT_BASE_HEIGHT,
  LABEL_PREFIX,
  PRESET_BAND,
  PRESET_KIND,
  PRESETS,
} from "@/lib/kitchen/presets";
import type { PresetId } from "@/lib/kitchen/presets";
import type { KitchenProject, Placement } from "@/lib/kitchen/types";
import CabinetForm from "./CabinetForm";
import CutList from "./CutList";
import Elevation from "./Elevation";
import Hardware from "./Hardware";
import PlanView from "./PlanView";
import WallElevations from "./WallElevations";

const RoomViewport = dynamic(() => import("./RoomViewport"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-[var(--aw-muted)]">
      3D…
    </div>
  ),
});

const WALL_IDS = ["A", "B", "C"];

const DEFAULT_PROJECT: KitchenProject = {
  name: "Kitchen",
  walls: [
    { id: "A", length: 3600 },
    { id: "B", length: 2400 },
  ],
  wallHeight: 2600,
  bandGap: DEFAULT_BAND_GAP,
  placements: [
    { id: "t1", label: "T1", wallId: "A", band: "tall", params: PRESETS["tall-unit"] },
    { id: "k1", label: "K1", wallId: "A", band: "base", params: PRESETS["base-doors"] },
    { id: "k2", label: "K2", wallId: "A", band: "base", params: PRESETS["base-drawers"] },
    { id: "k3", label: "K3", wallId: "A", band: "base", params: PRESETS["base-doors"] },
    { id: "w1", label: "W1", wallId: "A", band: "wall", params: PRESETS["wall-unit"] },
    { id: "w2", label: "W2", wallId: "A", band: "wall", params: PRESETS["wall-unit"] },
    { id: "k4", label: "K4", wallId: "B", band: "base", params: PRESETS["base-doors"] },
    { id: "k5", label: "K5", wallId: "B", band: "base", params: PRESETS["base-doors"] },
    { id: "w3", label: "W3", wallId: "B", band: "wall", params: PRESETS["wall-unit"] },
  ],
};

const PRESET_BUTTONS: Array<{ id: PresetId; label: { ka: string; en: string } }> = [
  { id: "base-doors", label: copy.studio.kitchen.presets.baseDoors },
  { id: "base-drawers", label: copy.studio.kitchen.presets.baseDrawers },
  { id: "sink-base", label: copy.studio.kitchen.presets.sink },
  { id: "oven-base", label: copy.studio.kitchen.presets.oven },
  { id: "hob-base", label: copy.studio.kitchen.presets.hob },
  { id: "fridge-tall", label: copy.studio.kitchen.presets.fridge },
  { id: "hood-unit", label: copy.studio.kitchen.presets.hood },
  { id: "wall-unit", label: copy.studio.kitchen.presets.wallUnit },
  { id: "tall-unit", label: copy.studio.kitchen.presets.tallUnit },
  { id: "space", label: copy.studio.kitchen.presets.space },
];

const sectionTitle =
  "text-[13px] font-medium uppercase tracking-[0.18em] text-[var(--aw-muted)]";

function CommitNumberInput({
  value,
  min,
  max,
  step,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (n: number) => void;
}) {
  const [raw, setRaw] = useState(String(value));
  useEffect(() => setRaw(String(value)), [value]);
  return (
    <input
      type="number"
      inputMode="numeric"
      value={raw}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        setRaw(e.target.value);
        const n = Number(e.target.value);
        if (Number.isFinite(n) && n >= min && n <= max) onCommit(n);
      }}
      className="h-9 w-24 rounded-md border border-[var(--aw-line)] bg-white px-2 text-right text-[14px] tabular-nums"
    />
  );
}

export default function KitchenStudio() {
  const mine = useQuery(api.projects.getMine);
  const save = useMutation(api.projects.save);

  const [project, setProject] = useState<KitchenProject>(DEFAULT_PROJECT);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [auth, setAuth] = useState<boolean | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const loadedRef = useRef(false);
  const lastValidRef = useRef(new Map<string, CabinetParams>());
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(
    null,
  );
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  // floating measurements panel: null = default anchor, else viewport coords
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const popupRef = useRef<HTMLDivElement | null>(null);
  const popupDragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const clipboardRef = useRef<Placement | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    if (mine !== undefined && !loadedRef.current) {
      loadedRef.current = true;
      setAuth(mine.authenticated);
      if (mine.project) {
        const legacy = mine.project.wallBandBottom;
        setProject({
          ...mine.project,
          wallHeight: mine.project.wallHeight ?? 2600,
          // migrate the old floor-measured setting to a counter-measured gap
          bandGap:
            mine.project.bandGap ??
            (legacy != null
              ? Math.min(
                  1200,
                  Math.max(
                    100,
                    legacy - DEFAULT_BASE_HEIGHT - COUNTER_THICKNESS,
                  ),
                )
              : DEFAULT_BAND_GAP),
        });
      }
    }
  }, [mine]);

  // substitute the last valid params while the user types through an
  // invalid intermediate state, so the layout never breaks
  // (spacers skip cabinet validation — only their width matters)
  const guarded = useMemo<KitchenProject>(() => {
    const placements = project.placements
      .map((p) => {
        if (p.kind === "spacer" || validate(p.params).length === 0) {
          lastValidRef.current.set(p.id, p.params);
          return p;
        }
        const lastValid = lastValidRef.current.get(p.id);
        return lastValid ? { ...p, params: lastValid } : null;
      })
      .filter((p): p is Placement => p !== null);
    return { ...project, placements };
  }, [project]);

  const layout = useMemo(() => layoutKitchen(guarded), [guarded]);

  useEffect(() => {
    if (!loadedRef.current || auth !== true) return;
    setSaveState("saving");
    const t = setTimeout(() => {
      save({
        name: guarded.name,
        walls: guarded.walls,
        wallHeight: guarded.wallHeight,
        bandGap: guarded.bandGap,
        placements: guarded.placements,
      })
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("idle"));
    }, 900);
    return () => clearTimeout(t);
  }, [guarded, auth, save]);

  const selected = project.placements.find((p) => p.id === selectedId) ?? null;
  const selectedErrors =
    selected && selected.kind !== "spacer" ? validate(selected.params) : [];
  const selectedSolved = selected
    ? layout.cabinets.find((c) => c.placement.id === selected.id)
    : null;

  const allPanels = useMemo(
    () => layout.cabinets.flatMap((c) => c.panels),
    [layout],
  );
  const allHardware = useMemo(() => {
    const merged = new Map<string, HardwareItem>();
    for (const cabinet of layout.cabinets) {
      for (const item of countHardware(cabinet.placement.params)) {
        const key = item.kind + item.spec;
        const existing = merged.get(key);
        if (existing) existing.qty += item.qty;
        else merged.set(key, { ...item });
      }
    }
    return [...merged.values()];
  }, [layout]);

  const labelFor = (
    placements: Placement[],
    band: Placement["band"],
    kind: "cabinet" | "spacer",
  ) => {
    const prefix = kind === "spacer" ? "S" : LABEL_PREFIX[band];
    const count = placements.filter(
      (p) =>
        (p.kind === "spacer" ? "S" : LABEL_PREFIX[p.band]) === prefix,
    ).length;
    return `${prefix}${count + 1}`;
  };

  const addCabinet = (wallId: string, preset: PresetId) => {
    const band = PRESET_BAND[preset];
    const kind = PRESET_KIND[preset];
    const placement: Placement = {
      id: crypto.randomUUID(),
      label: labelFor(project.placements, band, kind),
      wallId,
      band,
      kind,
      params: PRESETS[preset],
    };
    setProject((prev) => ({
      ...prev,
      placements: [...prev.placements, placement],
    }));
    setSelectedId(placement.id);
  };

  const removeCabinet = (id: string) => {
    setProject((prev) => ({
      ...prev,
      placements: prev.placements.filter((p) => p.id !== id),
    }));
    if (selectedId === id) setSelectedId(null);
  };

  // insert a copy right after the source, same properties, next label
  const duplicateCabinet = (id: string) => {
    const newId = crypto.randomUUID();
    setProject((prev) => {
      const index = prev.placements.findIndex((p) => p.id === id);
      if (index === -1) return prev;
      const src = prev.placements[index];
      const clone: Placement = {
        ...src,
        id: newId,
        label: labelFor(prev.placements, src.band, src.kind ?? "cabinet"),
        params: { ...src.params },
      };
      const next = [...prev.placements];
      next.splice(index + 1, 0, clone);
      return { ...prev, placements: next };
    });
    setSelectedId(newId);
  };

  // drag & drop: move the dragged placement to sit before the drop target,
  // constrained to the same wall + run (floor cabinets share one run)
  const reorderTo = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setProject((prev) => {
      const dragged = prev.placements.find((p) => p.id === draggedId);
      const target = prev.placements.find((p) => p.id === targetId);
      if (!dragged || !target) return prev;
      const sameRun =
        dragged.wallId === target.wallId &&
        (dragged.band === "wall") === (target.band === "wall");
      if (!sameRun) return prev;
      const without = prev.placements.filter((p) => p.id !== draggedId);
      const at = without.findIndex((p) => p.id === targetId);
      without.splice(at, 0, dragged);
      return { ...prev, placements: without };
    });
  };

  // paste a copied placement after its source (or at the end of its wall)
  const pastePlacement = (clip: Placement) => {
    const newId = crypto.randomUUID();
    setProject((prev) => {
      const clone: Placement = {
        ...clip,
        id: newId,
        label: labelFor(prev.placements, clip.band, clip.kind ?? "cabinet"),
        params: { ...clip.params },
      };
      const sourceIndex = prev.placements.findIndex((p) => p.id === clip.id);
      const next = [...prev.placements];
      next.splice(
        sourceIndex === -1 ? next.length : sourceIndex + 1,
        0,
        clone,
      );
      return { ...prev, placements: next };
    });
    setSelectedId(newId);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      ) {
        return;
      }
      if (e.key.toLowerCase() === "c") {
        const sel = projectRef.current.placements.find(
          (p) => p.id === selectedIdRef.current,
        );
        if (sel) clipboardRef.current = { ...sel, params: { ...sel.params } };
      } else if (e.key.toLowerCase() === "v") {
        if (clipboardRef.current) {
          e.preventDefault();
          pastePlacement(clipboardRef.current);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSelectedParams = (params: CabinetParams) => {
    if (!selected) return;
    setProject((prev) => ({
      ...prev,
      placements: prev.placements.map((p) =>
        p.id === selected.id ? { ...p, params } : p,
      ),
    }));
  };

  const setWallLength = (wallId: string, length: number) => {
    setProject((prev) => ({
      ...prev,
      walls: prev.walls.map((w) => (w.id === wallId ? { ...w, length } : w)),
    }));
  };

  const setWallCount = (count: number) => {
    setProject((prev) => {
      const walls = Array.from(
        { length: count },
        (_, i) => prev.walls[i] ?? { id: WALL_IDS[i], length: 2400 },
      );
      const kept = new Set(walls.map((w) => w.id));
      return {
        ...prev,
        walls,
        placements: prev.placements.filter((p) => kept.has(p.wallId)),
      };
    });
  };

  return (
    <div className="mx-auto grid w-full max-w-[1600px] flex-1 gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[320px_minmax(0,1fr)]">
      {/* right-click context menu */}
      {menu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu(null);
            }}
          />
          <div
            className="fixed z-50 w-48 rounded-md border border-[var(--aw-line)] bg-white p-1 shadow-md"
            style={{ left: menu.x, top: menu.y }}
          >
            <button
              type="button"
              onClick={() => {
                duplicateCabinet(menu.id);
                setMenu(null);
              }}
              className="block w-full rounded px-3 py-2 text-left text-[13px] hover:bg-[var(--aw-paper)]"
            >
              <T s={copy.studio.kitchen.duplicate} />
            </button>
            <button
              type="button"
              onClick={() => {
                removeCabinet(menu.id);
                setMenu(null);
              }}
              className="block w-full rounded px-3 py-2 text-left text-[13px] text-[#9B3B2E] hover:bg-[var(--aw-paper)]"
            >
              <T s={copy.studio.kitchen.remove} />
            </button>
          </div>
        </>
      )}
      {/* left rail: walls + cabinet lists */}
      <aside className="space-y-8">
        <div>
          <div className="flex items-baseline justify-between">
            <h2 className={sectionTitle}>
              <T s={copy.studio.kitchen.walls} />
            </h2>
            {auth === true && (
              <span className="text-[12px] text-[var(--aw-muted)]">
                {saveState === "saving" ? (
                  <T s={copy.studio.kitchen.saving} />
                ) : saveState === "saved" ? (
                  <T s={copy.studio.kitchen.saved} />
                ) : null}
              </span>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div
              className="grid flex-1 grid-cols-3 overflow-hidden rounded-md border border-[var(--aw-line)]"
              role="group"
            >
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setWallCount(n)}
                  aria-pressed={project.walls.length === n}
                  className={`h-9 text-[13px] font-medium transition-colors ${
                    project.walls.length === n
                      ? "bg-[var(--aw-ink)] text-[var(--aw-paper)]"
                      : "bg-white text-[var(--aw-muted)] hover:text-[var(--aw-ink)]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-[13px] text-[var(--aw-muted)]">
            <span>
              <T s={copy.studio.kitchen.wallHeight} />
            </span>
            <span className="flex items-center gap-2">
              <CommitNumberInput
                value={project.wallHeight}
                min={2200}
                max={3600}
                step={50}
                onCommit={(wallHeight) =>
                  setProject((prev) => ({ ...prev, wallHeight }))
                }
              />
              mm
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-[13px] text-[var(--aw-muted)]">
            <span>
              <T s={copy.studio.kitchen.bandHeight} />
            </span>
            <span className="flex items-center gap-2">
              <CommitNumberInput
                value={project.bandGap}
                min={100}
                max={1200}
                step={10}
                onCommit={(bandGap) =>
                  setProject((prev) => ({ ...prev, bandGap }))
                }
              />
              mm
            </span>
          </div>
        </div>

        {project.walls.map((wall) => {
          const floor = project.placements.filter(
            (p) => p.wallId === wall.id && p.band !== "wall",
          );
          const hung = project.placements.filter(
            (p) => p.wallId === wall.id && p.band === "wall",
          );
          const freeFloor = layout.runs.find(
            (r) => r.wallId === wall.id && r.band === "base",
          )?.freeSpace;
          return (
            <div key={wall.id} className="border-t border-[var(--aw-line)] pt-5">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-medium">
                  <T s={copy.studio.kitchen.wall} /> {wall.id}
                </span>
                <div className="flex items-center gap-2 text-[13px] text-[var(--aw-muted)]">
                  <CommitNumberInput
                    value={wall.length}
                    min={600}
                    max={8000}
                    step={100}
                    onCommit={(len) => setWallLength(wall.id, len)}
                  />
                  <span>mm</span>
                </div>
              </div>
              {typeof freeFloor === "number" && (
                <p
                  className={`mt-2 text-[12px] ${
                    freeFloor < 0
                      ? "font-medium text-[#9B3B2E]"
                      : "text-[var(--aw-muted)]"
                  }`}
                >
                  <T s={copy.studio.kitchen.free} /> ·{" "}
                  <span className="tabular-nums">{freeFloor}</span> mm
                </p>
              )}
              <ul className="mt-3 space-y-1.5">
                {[...floor, ...hung].map((p) => (
                  <li
                    key={p.id}
                    draggable
                    onDragStart={(e) => {
                      dragIdRef.current = p.id;
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverId(p.id);
                    }}
                    onDragLeave={() =>
                      setDragOverId((cur) => (cur === p.id ? null : cur))
                    }
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIdRef.current) reorderTo(dragIdRef.current, p.id);
                      dragIdRef.current = null;
                      setDragOverId(null);
                    }}
                    onDragEnd={() => {
                      dragIdRef.current = null;
                      setDragOverId(null);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSelectedId(p.id);
                      setMenu({ x: e.clientX, y: e.clientY, id: p.id });
                    }}
                    className={`flex items-center gap-1.5 rounded-md ${
                      dragOverId === p.id
                        ? "ring-1 ring-[var(--aw-walnut)]"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className={`flex h-9 flex-1 cursor-grab items-center justify-between rounded-md border px-3 text-[13px] transition-colors active:cursor-grabbing ${
                        selectedId === p.id
                          ? "border-[var(--aw-walnut)] text-[var(--aw-ink)]"
                          : "border-[var(--aw-line)] text-[var(--aw-muted)] hover:text-[var(--aw-ink)]"
                      }`}
                    >
                      <span className="font-medium">{p.label}</span>
                      <span className="tabular-nums">
                        {p.kind === "spacer"
                          ? p.params.width
                          : `${p.params.width} × ${p.params.height}`}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label="remove"
                      onClick={() => removeCabinet(p.id)}
                      className="h-9 w-7 rounded-md border border-[var(--aw-line)] text-[12px] text-[var(--aw-muted)] hover:text-[#9B3B2E]"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {PRESET_BUTTONS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => addCabinet(wall.id, id)}
                    className="h-9 rounded-md border border-[var(--aw-line)] px-2 text-[12px] font-medium text-[var(--aw-muted)] transition-colors hover:border-[var(--aw-walnut)] hover:text-[var(--aw-ink)]"
                  >
                    + <T s={label} />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </aside>

      {/* main column */}
      <div className="flex min-w-0 flex-col gap-10">
        <div className="relative h-[420px] overflow-hidden rounded-md border border-[var(--aw-line)] lg:h-[560px]">
          <RoomViewport
            project={guarded}
            layout={layout}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          {/* measurements popup — floats like a Figma panel, drag its header */}
          {selected && (
            <div
              ref={popupRef}
              style={popupPos ? { left: popupPos.x, top: popupPos.y } : undefined}
              className={`${
                popupPos
                  ? "fixed z-50 max-h-[75vh]"
                  : "absolute right-3 top-3 max-h-[calc(100%-24px)]"
              } w-[320px] max-w-[88%] overflow-y-auto rounded-md border border-[var(--aw-line)] bg-white/95 p-4 shadow-md backdrop-blur`}
            >
              <div
                className="mb-4 flex cursor-grab touch-none items-start justify-between active:cursor-grabbing"
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  const rect = popupRef.current!.getBoundingClientRect();
                  popupDragRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: rect.left,
                    origY: rect.top,
                  };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const d = popupDragRef.current;
                  if (!d) return;
                  setPopupPos({
                    x: Math.min(
                      Math.max(8, d.origX + e.clientX - d.startX),
                      window.innerWidth - 80,
                    ),
                    y: Math.min(
                      Math.max(8, d.origY + e.clientY - d.startY),
                      window.innerHeight - 60,
                    ),
                  });
                }}
                onPointerUp={() => {
                  popupDragRef.current = null;
                }}
              >
                <div>
                  <span className="text-[15px] font-semibold">
                    {selected.label}
                  </span>
                  <span className="ml-2 text-[13px] tabular-nums text-[var(--aw-muted)]">
                    {selected.kind === "spacer"
                      ? selected.params.width
                      : `${selected.params.width} × ${selected.params.height} × ${selected.params.depth}`}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="close"
                  onClick={() => setSelectedId(null)}
                  className="ml-3 h-7 w-7 rounded-md border border-[var(--aw-line)] text-[12px] text-[var(--aw-muted)] hover:text-[var(--aw-ink)]"
                >
                  ✕
                </button>
              </div>
              {selected.kind === "spacer" ? (
                <div className="flex items-center justify-between gap-2 text-[13px] text-[var(--aw-muted)]">
                  <span>
                    <T s={copy.studio.fields.width} /> · mm
                  </span>
                  <CommitNumberInput
                    value={selected.params.width}
                    min={50}
                    max={2000}
                    step={50}
                    onCommit={(width) =>
                      updateSelectedParams({ ...selected.params, width })
                    }
                  />
                </div>
              ) : (
                <CabinetForm
                  params={selected.params}
                  errors={selectedErrors}
                  onChange={updateSelectedParams}
                />
              )}
              <button
                type="button"
                onClick={() => removeCabinet(selected.id)}
                className="mt-5 h-9 w-full rounded-md border border-[var(--aw-line)] text-[13px] font-medium text-[#9B3B2E] transition-colors hover:border-[#9B3B2E]"
              >
                <T s={copy.studio.kitchen.remove} /> · {selected.label}
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-10 xl:grid-cols-2">
          <section className="min-w-0">
            <h2 className={sectionTitle}>
              <T s={copy.studio.kitchen.plan} />
            </h2>
            <div className="mt-4 rounded-md border border-[var(--aw-line)] bg-white p-2">
              <PlanView
                project={guarded}
                layout={layout}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          </section>

          <section className="min-w-0">
            <h2 className={sectionTitle}>
              <T s={copy.studio.kitchen.card} />
              {selected && (
                <span className="normal-case tracking-normal">
                  {" "}
                  · {selected.label}
                </span>
              )}
            </h2>
            {selected ? (
              <div className="mt-4 space-y-6">
                {selectedSolved && (
                  <div className="grid gap-8 sm:grid-cols-2">
                    <div className="min-w-0">
                      <Elevation
                        panels={selectedSolved.panels}
                        params={selectedSolved.placement.params}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="overflow-x-auto">
                        <CutList panels={selectedSolved.panels} />
                      </div>
                      <div className="mt-4">
                        <Hardware
                          items={countHardware(
                            selectedSolved.placement.params,
                          )}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-[14px] text-[var(--aw-muted)]">
                <T s={copy.studio.kitchen.selectHint} />
              </p>
            )}
          </section>
        </div>

        <section>
          <h2 className={sectionTitle}>
            <T s={copy.studio.kitchen.elevations} />
          </h2>
          <div className="mt-4">
            <WallElevations
              project={guarded}
              layout={layout}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        </section>

        <section>
          <h2 className={sectionTitle}>
            <T s={copy.studio.kitchen.fullCutList} />{" "}
            <span className="normal-case tracking-normal">· mm</span>
          </h2>
          <div className="mt-4 overflow-x-auto">
            <CutList panels={allPanels} />
          </div>
          {allHardware.length > 0 && (
            <>
              <h2 className={`${sectionTitle} mt-8`}>
                <T s={copy.studio.hardware.title} />
              </h2>
              <div className="mt-4 max-w-md">
                <Hardware items={allHardware} />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
