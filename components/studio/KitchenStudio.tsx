"use client";

import { useMutation, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import T from "@/components/landing/T";
import { copy } from "@/components/landing/copy";
import { countHardware, validate } from "@/lib/cabinet/solve";
import type { CabinetParams, HardwareItem } from "@/lib/cabinet/types";
import { exportPacketAsPdf, pdfFilename } from "@/lib/exportPdf";
import type { PdfProgress } from "@/lib/exportPdf";
import { layoutKitchen, moveInRun } from "@/lib/kitchen/layout";
import {
  CORNER_BASE_DEFAULTS,
  CORNER_LABEL_PREFIX,
  CORNER_PARAMS,
  CORNER_WALL_DEFAULTS,
  COUNTER_THICKNESS,
  DEFAULT_BAND_GAP,
  DEFAULT_BASE_HEIGHT,
  LABEL_PREFIX,
  PRESET_BAND,
  PRESET_KIND,
  PRESETS,
} from "@/lib/kitchen/presets";
import type { PresetId } from "@/lib/kitchen/presets";
import type {
  CornerParams,
  KitchenProject,
  Placement,
  Turn,
} from "@/lib/kitchen/types";
import CabinetForm from "./CabinetForm";
import CornerForm from "./CornerForm";
import LayoutModal from "./LayoutModal";
import PlanView from "./PlanView";
import PrintPacket from "./PrintPacket";

type ViewportHandle = { snapshot: () => string | null };

const RoomViewport = dynamic(() => import("./RoomViewport"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-[var(--aw-muted)]">
      3D…
    </div>
  ),
});

const WALL_IDS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const LAST_PROJECT_KEY = "aewyo-last-project";
const HISTORY_LIMIT = 100;
const COALESCE_MS = 700;

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
const iconBtn =
  "inline-flex h-9 items-center justify-center rounded-md border border-[var(--aw-line)] bg-white text-[var(--aw-muted)] transition-colors hover:bg-[var(--aw-paper)] hover:text-[var(--aw-ink)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-[var(--aw-muted)]";

type SavedProject = NonNullable<
  ReturnType<typeof useQuery<typeof api.projects.get>>
>;
type ProjectSummary = NonNullable<
  ReturnType<typeof useQuery<typeof api.projects.list>>
>["projects"][number];

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
  // re-sync the draft text when the committed value changes from outside
  // (undo, project switch) — derived-state pattern, no effect needed
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setRaw(String(value));
  }
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
      className="h-9 w-24 rounded-md border border-[var(--aw-line)] bg-white px-2 text-right text-[14px] tabular-nums transition-colors focus:border-[var(--aw-walnut)] focus:outline-none"
    />
  );
}

function fromSaved(doc: SavedProject): KitchenProject {
  const legacy = doc.wallBandBottom;
  return {
    name: doc.name,
    walls: doc.walls,
    wallHeight: doc.wallHeight ?? 2600,
    // migrate the old floor-measured setting to a counter-measured gap
    bandGap:
      doc.bandGap ??
      (legacy != null
        ? Math.min(
            1200,
            Math.max(100, legacy - DEFAULT_BASE_HEIGHT - COUNTER_THICKNESS),
          )
        : DEFAULT_BAND_GAP),
    placements: doc.placements,
  };
}

function timeAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  return new Date(ms).toLocaleDateString("en-GB");
}

export default function KitchenStudio() {
  // ---------- persistence ----------
  const listing = useQuery(api.projects.list);
  const [projectId, setProjectId] = useState<Id<"projects"> | null>(null);
  const loaded = useQuery(
    api.projects.get,
    projectId ? { id: projectId } : "skip",
  );
  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);
  const removeProject = useMutation(api.projects.remove);

  const [project, setProject] = useState<KitchenProject>(DEFAULT_PROJECT);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const appliedIdRef = useRef<Id<"projects"> | null>(null);
  const initRef = useRef(false);

  // ---------- editor ----------
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // wall-first flow: new projects start on the walls step
  const [step, setStep] = useState<"walls" | "cabinets">("cabinets");
  const [view, setView] = useState<"persp" | "iso">("persp");
  const viewportRef = useRef<ViewportHandle | null>(null);
  const [isLayoutOpen, setIsLayoutOpen] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(
    null,
  );
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
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
  // memo of the last valid params per cabinet (a stable mutable cache)
  const [lastValid] = useState(() => new Map<string, CabinetParams>());
  // latest values for event handlers (kept in sync by effects + commit)
  const projectRef = useRef(project);
  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // ---------- history ----------
  const historyRef = useRef<{
    past: KitchenProject[];
    future: KitchenProject[];
    lastAt: number;
  }>({ past: [], future: [], lastAt: 0 });
  const [hist, setHist] = useState({ past: 0, future: 0 });
  const syncHist = () =>
    setHist({
      past: historyRef.current.past.length,
      future: historyRef.current.future.length,
    });

  const resetHistory = () => {
    historyRef.current = { past: [], future: [], lastAt: 0 };
    setHist({ past: 0, future: 0 });
  };

  /** Every edit goes through here: pushes undo history + marks dirty.
   *  `coalesce` merges rapid successive edits (typing) into one step. */
  const commit = useCallback(
    (
      updater: (prev: KitchenProject) => KitchenProject,
      opts: { coalesce?: boolean } = {},
    ) => {
      const prev = projectRef.current;
      const next = updater(prev);
      if (next === prev) return;
      const h = historyRef.current;
      const now = Date.now();
      if (!(opts.coalesce && now - h.lastAt < COALESCE_MS)) {
        h.past.push(prev);
        if (h.past.length > HISTORY_LIMIT) h.past.shift();
      }
      h.lastAt = now;
      h.future = [];
      projectRef.current = next;
      setProject(next);
      setDirty(true);
      syncHist();
    },
    [],
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push(projectRef.current);
    h.lastAt = 0;
    projectRef.current = prev;
    setProject(prev);
    setDirty(true);
    syncHist();
  }, []);

  const redo = useCallback(() => {
    const h = historyRef.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(projectRef.current);
    h.lastAt = 0;
    projectRef.current = next;
    setProject(next);
    setDirty(true);
    syncHist();
  }, []);

  const canUndo = hist.past > 0;
  const canRedo = hist.future > 0;

  // ---------- toasts ----------
  const [toasts, setToasts] = useState<
    Array<{ id: number; text: React.ReactNode; tone: "ok" | "err" }>
  >([]);
  const toast = useCallback((text: React.ReactNode, tone: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  // ---------- load: pick a project once the list is known ----------
  // (Convex query results are an external subscription; applying them to
  // editor state happens in a microtask callback, off the effect body)
  useEffect(() => {
    if (listing === undefined || initRef.current) return;
    initRef.current = true;
    queueMicrotask(() => {
      if (!listing.authenticated || listing.projects.length === 0) {
        setProject(DEFAULT_PROJECT);
        projectRef.current = DEFAULT_PROJECT;
        setDirty(listing.authenticated);
        setReady(true);
        return;
      }
      let last: string | null = null;
      try {
        last = localStorage.getItem(LAST_PROJECT_KEY);
      } catch {
        // ignore
      }
      const pick =
        listing.projects.find((p) => p._id === last) ?? listing.projects[0];
      setProjectId(pick._id);
    });
  }, [listing]);

  // apply a freshly loaded document (once per id)
  useEffect(() => {
    if (!projectId || loaded === undefined) return;
    if (appliedIdRef.current === projectId) return;
    queueMicrotask(() => {
      if (loaded === null) {
        // deleted elsewhere — fall back to a draft
        appliedIdRef.current = null;
        setProjectId(null);
        setProject(DEFAULT_PROJECT);
        projectRef.current = DEFAULT_PROJECT;
        setDirty(true);
        setReady(true);
        return;
      }
      appliedIdRef.current = projectId;
      const next = fromSaved(loaded);
      setProject(next);
      projectRef.current = next;
      setDirty(false);
      setSavedAt(loaded.updatedAt ?? loaded._creationTime);
      setSelectedId(null);
      resetHistory();
      setReady(true);
      try {
        localStorage.setItem(LAST_PROJECT_KEY, projectId);
      } catch {
        // ignore
      }
    });
  }, [projectId, loaded]);

  // warn before leaving with unsaved work
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const authenticated = listing?.authenticated === true;

  const saveNow = useCallback(async () => {
    if (!authenticated || saving) return;
    const p = projectRef.current;
    setSaving(true);
    try {
      const data = {
        name: p.name.trim() || "Kitchen",
        walls: p.walls,
        wallHeight: p.wallHeight,
        bandGap: p.bandGap,
        placements: p.placements,
      };
      if (projectId) {
        await updateProject({ id: projectId, ...data });
      } else {
        const id = await createProject(data);
        appliedIdRef.current = id;
        setProjectId(id);
        try {
          localStorage.setItem(LAST_PROJECT_KEY, id);
        } catch {
          // ignore
        }
      }
      setDirty(false);
      setSavedAt(Date.now());
      toast(<T s={copy.studio.kitchen.savedAt} />);
    } catch (err) {
      console.error(err);
      toast("Save failed", "err");
    } finally {
      setSaving(false);
    }
  }, [authenticated, saving, projectId, updateProject, createProject, toast]);

  const confirmDiscard = () =>
    !dirty || window.confirm(copy.studio.kitchen.confirmDiscard.en);

  const openProject = (id: Id<"projects">) => {
    if (id === projectId) return;
    if (!confirmDiscard()) return;
    setProjectMenuOpen(false);
    setProjectId(id);
  };

  const newProject = () => {
    if (!confirmDiscard()) return;
    setProjectMenuOpen(false);
    appliedIdRef.current = null;
    setProjectId(null);
    const count = listing?.projects.length ?? 0;
    const draft: KitchenProject = {
      ...DEFAULT_PROJECT,
      name: `Kitchen ${count + 1}`,
      walls: [{ id: "A", length: 3600 }],
      placements: [],
    };
    setProject(draft);
    projectRef.current = draft;
    setDirty(true);
    setSavedAt(null);
    setSelectedId(null);
    resetHistory();
    // wall-first: a fresh project starts by shaping the room
    setStep("walls");
    setSidebarOpen(true);
  };

  const deleteProject = async (id: Id<"projects">) => {
    if (!window.confirm(copy.studio.kitchen.confirmDelete.en)) return;
    await removeProject({ id });
    setProjectMenuOpen(false);
    if (id === projectId) {
      const rest = (listing?.projects ?? []).filter((p) => p._id !== id);
      appliedIdRef.current = null;
      if (rest.length > 0) {
        setProjectId(rest[0]._id);
      } else {
        setProjectId(null);
        setProject(DEFAULT_PROJECT);
        projectRef.current = DEFAULT_PROJECT;
        setDirty(true);
        setSavedAt(null);
        resetHistory();
      }
    }
  };

  // ---------- derived ----------
  // substitute the last valid params while the user types through an
  // invalid intermediate state, so the layout never breaks
  const guarded = useMemo<KitchenProject>(() => {
    const placements = project.placements
      .map((p) => {
        if (p.kind === "spacer" || validate(p.params).length === 0) {
          lastValid.set(p.id, p.params);
          return p;
        }
        const fallback = lastValid.get(p.id);
        return fallback ? { ...p, params: fallback } : null;
      })
      .filter((p): p is Placement => p !== null);
    return { ...project, placements };
  }, [project, lastValid]);

  const layout = useMemo(() => layoutKitchen(guarded), [guarded]);

  const selected = project.placements.find((p) => p.id === selectedId) ?? null;
  const selectedErrors =
    selected && selected.kind !== "spacer" && selected.kind !== "corner"
      ? validate(selected.params)
      : [];

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

  // ---------- edits ----------
  const prefixOf = (p: Pick<Placement, "kind" | "band">) =>
    p.kind === "spacer"
      ? "S"
      : p.kind === "corner"
        ? CORNER_LABEL_PREFIX
        : LABEL_PREFIX[p.band];

  const labelFor = (
    placements: Placement[],
    band: Placement["band"],
    kind: "cabinet" | "spacer" | "corner",
  ) => {
    const prefix = prefixOf({ kind, band });
    const count = placements.filter((p) => prefixOf(p) === prefix).length;
    return `${prefix}${count + 1}`;
  };

  // corner cabinets live on a joint; drop them when the joint disappears
  // or turns convex (wall edits)
  const pruneCorners = (
    walls: KitchenProject["walls"],
    placements: Placement[],
  ): Placement[] => {
    const wallIds = new Set(walls.map((w) => w.id));
    return placements.filter((p) => {
      if (!wallIds.has(p.wallId)) return false;
      if (p.kind !== "corner") return true;
      const i = walls.findIndex((w) => w.id === p.wallId);
      return i >= 0 && i < walls.length - 1 && (walls[i].turn ?? "right") === "right";
    });
  };

  const addCorner = (wallId: string, band: "base" | "wall") => {
    const id = crypto.randomUUID();
    const defaults =
      band === "base" ? CORNER_BASE_DEFAULTS : CORNER_WALL_DEFAULTS;
    commit((prev) => {
      const taken = prev.placements.some(
        (p) => p.kind === "corner" && p.wallId === wallId && p.band === band,
      );
      if (taken) return prev;
      return {
        ...prev,
        placements: [
          ...prev.placements,
          {
            id,
            label: labelFor(prev.placements, band, "corner"),
            wallId,
            band,
            kind: "corner",
            params: CORNER_PARAMS[band],
            corner: { ...defaults },
          },
        ],
      };
    });
    setSelectedId(id);
  };

  const addCabinet = (wallId: string, preset: PresetId) => {
    const band = PRESET_BAND[preset];
    const kind = PRESET_KIND[preset];
    const id = crypto.randomUUID();
    commit((prev) => ({
      ...prev,
      placements: [
        ...prev.placements,
        {
          id,
          label: labelFor(prev.placements, band, kind),
          wallId,
          band,
          kind,
          params: PRESETS[preset],
        },
      ],
    }));
    setSelectedId(id);
  };

  const removeCabinet = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        placements: prev.placements.filter((p) => p.id !== id),
      }));
      if (selectedIdRef.current === id) setSelectedId(null);
    },
    [commit],
  );

  // insert a copy right after the source, same properties, next label
  const duplicateCabinet = useCallback(
    (id: string) => {
      const newId = crypto.randomUUID();
      let inserted = false;
      commit((prev) => {
        const index = prev.placements.findIndex((p) => p.id === id);
        if (index === -1) return prev;
        const src = prev.placements[index];
        if (src.kind === "corner") return prev; // one corner per joint+band
        const clone: Placement = {
          ...src,
          id: newId,
          label: labelFor(prev.placements, src.band, src.kind ?? "cabinet"),
          params: { ...src.params },
        };
        const next = [...prev.placements];
        next.splice(index + 1, 0, clone);
        inserted = true;
        return { ...prev, placements: next };
      });
      if (inserted) setSelectedId(newId);
    },
    [commit],
  );

  // drag & drop: move the dragged placement to sit before the drop target,
  // constrained to the same wall + run (floor cabinets share one run)
  const reorderTo = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    commit((prev) => {
      const dragged = prev.placements.find((p) => p.id === draggedId);
      const target = prev.placements.find((p) => p.id === targetId);
      if (!dragged || !target) return prev;
      if (dragged.kind === "corner" || target.kind === "corner") return prev;
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

  // 3D drag (Space + left): live-preview the reorder without touching
  // history, then record the whole drag as one undo step on release
  const dragSnapshotRef = useRef<KitchenProject | null>(null);
  const onDragStart3D = useCallback(() => {
    dragSnapshotRef.current = projectRef.current;
  }, []);
  const onDragMove3D = useCallback((id: string, index: number) => {
    const prev = projectRef.current;
    const me = prev.placements.find((p) => p.id === id);
    if (!me || me.kind === "corner") return;
    // corners are fixed on their joint: lift them out of the run ordering
    const runnable = prev.placements.filter((p) => p.kind !== "corner");
    const corners = prev.placements.filter((p) => p.kind === "corner");
    const moved = moveInRun(runnable, id, index);
    if (moved === runnable) return;
    const placements = [...moved, ...corners];
    if (placements === prev.placements) return;
    const next = { ...prev, placements };
    projectRef.current = next;
    setProject(next);
  }, []);
  const onDragEnd3D = useCallback(() => {
    const snapshot = dragSnapshotRef.current;
    dragSnapshotRef.current = null;
    if (!snapshot || snapshot === projectRef.current) return;
    const h = historyRef.current;
    h.past.push(snapshot);
    if (h.past.length > HISTORY_LIMIT) h.past.shift();
    h.future = [];
    h.lastAt = 0;
    setDirty(true);
    syncHist();
  }, []);

  // paste a copied placement after its source (or at the end of its wall)
  const pastePlacement = useCallback(
    (clip: Placement) => {
      const newId = crypto.randomUUID();
      commit((prev) => {
        const clone: Placement = {
          ...clip,
          id: newId,
          label: labelFor(prev.placements, clip.band, clip.kind ?? "cabinet"),
          params: { ...clip.params },
        };
        const sourceIndex = prev.placements.findIndex((p) => p.id === clip.id);
        const next = [...prev.placements];
        next.splice(sourceIndex === -1 ? next.length : sourceIndex + 1, 0, clone);
        return { ...prev, placements: next };
      });
      setSelectedId(newId);
    },
    [commit],
  );

  const updateSelectedParams = (params: CabinetParams) => {
    const id = selectedIdRef.current;
    if (!id) return;
    commit(
      (prev) => ({
        ...prev,
        placements: prev.placements.map((p) =>
          p.id === id ? { ...p, params } : p,
        ),
      }),
      { coalesce: true },
    );
  };

  const setWallLength = (wallId: string, length: number) => {
    commit(
      (prev) => ({
        ...prev,
        walls: prev.walls.map((w) => (w.id === wallId ? { ...w, length } : w)),
      }),
      { coalesce: true },
    );
  };

  const updateSelectedCorner = (corner: CornerParams) => {
    const id = selectedIdRef.current;
    if (!id) return;
    commit(
      (prev) => ({
        ...prev,
        placements: prev.placements.map((p) =>
          p.id === id ? { ...p, corner } : p,
        ),
      }),
      { coalesce: true },
    );
  };

  // ---- wall chain edits ----
  const nextWallId = (walls: KitchenProject["walls"]) => {
    const used = new Set(walls.map((w) => w.id));
    return WALL_IDS.find((id) => !used.has(id)) ?? `W${walls.length + 1}`;
  };

  const insertWallAfter = (index: number) => {
    commit((prev) => {
      const walls = [...prev.walls];
      walls.splice(index + 1, 0, {
        id: nextWallId(prev.walls),
        length: 1200,
        turn: "right",
      });
      // the previous wall now needs a turn toward the new one
      if (index >= 0 && walls[index].turn === undefined) {
        walls[index] = { ...walls[index], turn: "right" };
      }
      return {
        ...prev,
        walls,
        placements: pruneCorners(walls, prev.placements),
      };
    });
  };

  const removeWall = (wallId: string) => {
    commit((prev) => {
      if (prev.walls.length <= 1) return prev;
      const walls = prev.walls.filter((w) => w.id !== wallId);
      return {
        ...prev,
        walls,
        placements: pruneCorners(walls, prev.placements),
      };
    });
  };

  const setWallTurn = (wallId: string, turn: Turn) => {
    commit((prev) => {
      const walls = prev.walls.map((w) =>
        w.id === wallId ? { ...w, turn } : w,
      );
      return {
        ...prev,
        walls,
        placements: pruneCorners(walls, prev.placements),
      };
    });
  };

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        !!target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (key === "escape") {
        if (inField) {
          (target as HTMLElement).blur();
          return;
        }
        setMenu(null);
        setProjectMenuOpen(false);
        if (isLayoutOpen) setIsLayoutOpen(false);
        else setSelectedId(null);
        return;
      }
      if (mod && key === "s") {
        e.preventDefault();
        void saveNow();
        return;
      }
      if (inField) return;

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        redo();
      } else if (mod && key === "c") {
        const sel = projectRef.current.placements.find(
          (p) => p.id === selectedIdRef.current,
        );
        if (sel) clipboardRef.current = { ...sel, params: { ...sel.params } };
      } else if (mod && key === "v") {
        if (clipboardRef.current) {
          e.preventDefault();
          pastePlacement(clipboardRef.current);
        }
      } else if (mod && key === "d") {
        if (selectedIdRef.current) {
          e.preventDefault();
          duplicateCabinet(selectedIdRef.current);
        }
      } else if ((key === "delete" || key === "backspace") && !mod) {
        if (selectedIdRef.current) {
          e.preventDefault();
          removeCabinet(selectedIdRef.current);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    isLayoutOpen,
    saveNow,
    undo,
    redo,
    pastePlacement,
    duplicateCabinet,
    removeCabinet,
  ]);

  // ---------- pdf ----------
  const [exportProgress, setExportProgress] = useState<PdfProgress | null>(
    null,
  );
  const [printMounted, setPrintMounted] = useState(false);
  const printRef = useRef<HTMLDivElement | null>(null);

  const startPdf = () => {
    if (printMounted) return;
    setExportProgress({ page: 0, total: 0 });
    setPrintMounted(true);
  };

  useLayoutEffect(() => {
    if (!printMounted || !printRef.current) return;
    const root = printRef.current;
    let cancelled = false;
    // let fonts + layout settle before rasterising (a timer, not rAF, so a
    // backgrounded tab can't stall the export)
    const run = async () => {
      await new Promise((r) => setTimeout(r, 80));
      if (cancelled) return;
      try {
        await exportPacketAsPdf(root, pdfFilename(projectRef.current.name), (p) =>
          setExportProgress(p),
        );
        toast(<T s={copy.studio.kitchen.pdfReady} />);
      } catch (err) {
        console.error(err);
        toast(<T s={copy.studio.kitchen.pdfFailed} />, "err");
      } finally {
        setPrintMounted(false);
        setExportProgress(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [printMounted, toast]);

  // ---------- render ----------
  if (!ready) {
    return (
      <div className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="h-[58px] animate-pulse rounded-lg border border-[var(--aw-line)] bg-white" />
        <div className="flex flex-1 gap-6">
          <div className="hidden w-[340px] animate-pulse rounded-lg border border-[var(--aw-line)] bg-white lg:block" />
          <div className="flex h-[calc(100vh-210px)] min-h-[580px] flex-1 items-center justify-center rounded-lg border border-[var(--aw-line)] bg-white text-sm text-[var(--aw-muted)]">
            <T s={copy.studio.kitchen.loading} />
          </div>
        </div>
      </div>
    );
  }

  const projects: ProjectSummary[] = listing?.projects ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      {/* off-screen print document, mounted only while exporting */}
      {printMounted && (
        <PrintPacket
          ref={printRef}
          project={guarded}
          layout={layout}
          allPanels={allPanels}
          allHardware={allHardware}
        />
      )}

      {/* toasts */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`aw-toast rounded-md px-4 py-2 text-[13px] font-medium shadow-md ${
              t.tone === "err"
                ? "bg-[#9B3B2E] text-white"
                : "bg-[var(--aw-ink)] text-[var(--aw-paper)]"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>

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
            className="aw-pop fixed z-50 w-48 rounded-md border border-[var(--aw-line)] bg-white p-1 shadow-md"
            style={{ left: menu.x, top: menu.y }}
          >
            <button
              type="button"
              onClick={() => {
                duplicateCabinet(menu.id);
                setMenu(null);
              }}
              className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-[13px] hover:bg-[var(--aw-paper)]"
            >
              <T s={copy.studio.kitchen.duplicate} />
              <kbd className="text-[11px] text-[var(--aw-muted)]">Ctrl+D</kbd>
            </button>
            <button
              type="button"
              onClick={() => {
                removeCabinet(menu.id);
                setMenu(null);
              }}
              className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-[13px] text-[#9B3B2E] hover:bg-[var(--aw-paper)]"
            >
              <T s={copy.studio.kitchen.remove} />
              <kbd className="text-[11px] text-[var(--aw-muted)]">Del</kbd>
            </button>
          </div>
        </>
      )}

      {/* Top Studio Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--aw-line)] bg-white px-4 py-3 shadow-xs">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`${iconBtn} w-9 shrink-0`}
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-200 ${sidebarOpen ? "rotate-0" : "rotate-180"}`}
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
              <path d="m14 15-3-3 3-3" />
            </svg>
          </button>

          {/* project switcher */}
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() => setProjectMenuOpen((o) => !o)}
              className="flex h-9 max-w-[320px] items-center gap-2 rounded-md border border-[var(--aw-line)] bg-white px-3 text-[13px] transition-colors hover:bg-[var(--aw-paper)]"
              aria-haspopup="menu"
              aria-expanded={projectMenuOpen}
            >
              <span className="truncate font-medium">{project.name}</span>
              {dirty && (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--aw-walnut)]"
                  title="Unsaved changes"
                />
              )}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-[var(--aw-muted)]"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {projectMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProjectMenuOpen(false)}
                />
                <div className="aw-pop absolute left-0 top-11 z-50 w-[340px] rounded-md border border-[var(--aw-line)] bg-white p-2 shadow-md">
                  <label className="block px-2 pb-2">
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--aw-muted)]">
                      <T s={copy.studio.kitchen.projectName} />
                    </span>
                    <input
                      value={project.name}
                      onChange={(e) =>
                        commit((prev) => ({ ...prev, name: e.target.value }), {
                          coalesce: true,
                        })
                      }
                      className="mt-1 h-9 w-full rounded-md border border-[var(--aw-line)] px-2 text-[14px] transition-colors focus:border-[var(--aw-walnut)] focus:outline-none"
                    />
                  </label>
                  <div className="my-1 border-t border-[var(--aw-line)]" />
                  <div className="px-2 pt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--aw-muted)]">
                    <T s={copy.studio.kitchen.projects} />
                  </div>
                  <ul className="max-h-[260px] overflow-y-auto py-1">
                    {!authenticated && (
                      <li className="px-2 py-2 text-[13px] text-[var(--aw-muted)]">
                        <T s={copy.studio.kitchen.signInToSave} />
                      </li>
                    )}
                    {projects.map((p) => {
                      const current = p._id === projectId;
                      return (
                        <li
                          key={p._id}
                          className={`group flex items-center gap-2 rounded px-2 py-1.5 text-[13px] ${
                            current
                              ? "bg-[var(--aw-paper)]"
                              : "hover:bg-[var(--aw-paper)]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => openProject(p._id)}
                            className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                          >
                            <span className={`truncate ${current ? "font-medium" : ""}`}>
                              {p.name}
                            </span>
                            <span className="shrink-0 text-[11px] tabular-nums text-[var(--aw-muted)]">
                              {p.cabinetCount} ·{" "}
                              {timeAgo(p.updatedAt ?? p._creationTime)}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteProject(p._id)}
                            className="shrink-0 rounded p-1 text-[11px] text-[var(--aw-muted)] opacity-0 transition-opacity hover:text-[#9B3B2E] group-hover:opacity-100"
                            aria-label="Delete project"
                            title={copy.studio.kitchen.deleteProject.en}
                          >
                            ✕
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="my-1 border-t border-[var(--aw-line)]" />
                  <button
                    type="button"
                    onClick={newProject}
                    className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-[13px] font-medium hover:bg-[var(--aw-paper)]"
                  >
                    + <T s={copy.studio.kitchen.newProject} />
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="hidden items-center gap-2 text-xs text-[var(--aw-muted)] md:flex">
            <span>
              {project.walls.length} <T s={copy.studio.kitchen.walls} /> ·{" "}
              {project.placements.length}{" "}
              <T s={copy.studio.kitchen.cabinets} />
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* undo / redo */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              className={`${iconBtn} w-9`}
              title={`${copy.studio.kitchen.undo.en} · Ctrl+Z`}
              aria-label={copy.studio.kitchen.undo.en}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
              </svg>
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              className={`${iconBtn} w-9`}
              title={`${copy.studio.kitchen.redo.en} · Ctrl+Y`}
              aria-label={copy.studio.kitchen.redo.en}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 7v6h-6" />
                <path d="M3 17a9 9 0 0 1 15-6.7L21 13" />
              </svg>
            </button>
          </div>

          <span
            className={`${iconBtn} hidden w-9 cursor-help sm:inline-flex`}
            title={copy.studio.kitchen.shortcutList.en}
            aria-label={copy.studio.kitchen.shortcuts.en}
          >
            ?
          </span>

          {/* save state + button */}
          <span className="hidden text-[12px] text-[var(--aw-muted)] lg:inline">
            {!authenticated ? (
              <T s={copy.studio.kitchen.signInToSave} />
            ) : dirty ? (
              <T s={copy.studio.kitchen.unsaved} />
            ) : savedAt ? (
              <>
                <T s={copy.studio.kitchen.savedAt} /> · {timeAgo(savedAt)}
              </>
            ) : (
              <T s={copy.studio.kitchen.neverSaved} />
            )}
          </span>
          <button
            type="button"
            onClick={() => void saveNow()}
            disabled={!authenticated || saving || (!dirty && !!projectId)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--aw-line)] bg-white px-3.5 text-[13px] font-medium text-[var(--aw-ink)] transition-colors hover:bg-[var(--aw-paper)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
            title="Ctrl+S"
          >
            {saving ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--aw-line)] border-t-[var(--aw-ink)]" />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            )}
            <span>
              <T s={copy.studio.kitchen.save} />
            </span>
          </button>

          {/* PDF */}
          <button
            type="button"
            onClick={startPdf}
            disabled={exportProgress !== null}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--aw-line)] bg-white px-3.5 text-[13px] font-medium text-[var(--aw-ink)] transition-colors hover:bg-[var(--aw-paper)] disabled:opacity-60"
          >
            {exportProgress ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--aw-line)] border-t-[var(--aw-ink)]" />
                <span className="tabular-nums">
                  {exportProgress.page}/{exportProgress.total || "…"}
                </span>
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
                <span>PDF</span>
              </>
            )}
          </button>

          {/* Layout / drawings */}
          <button
            type="button"
            onClick={() => setIsLayoutOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--aw-walnut)] px-4 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-[var(--aw-walnut-hover)] active:translate-y-px"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
            <span>
              <T s={copy.studio.kitchen.layout} />
            </span>
          </button>
        </div>
      </div>

      {/* Studio Workspace: Sidebar + 3D Viewport */}
      <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-start">
        {sidebarOpen && (
          <aside className="aw-pop w-full shrink-0 space-y-8 rounded-lg border border-[var(--aw-line)] bg-white p-5 shadow-xs lg:max-h-[calc(100vh-180px)] lg:w-[340px] lg:overflow-y-auto xl:w-[360px]">
            {/* step switch: walls first, then cabinets */}
            <div
              className="grid grid-cols-2 overflow-hidden rounded-md border border-[var(--aw-line)]"
              role="tablist"
            >
              {(["walls", "cabinets"] as const).map((s, i) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={step === s}
                  onClick={() => setStep(s)}
                  className={`h-9 text-[13px] font-medium transition-colors ${
                    step === s
                      ? "bg-[var(--aw-ink)] text-white"
                      : "bg-white text-[var(--aw-muted)] hover:text-[var(--aw-ink)]"
                  }`}
                >
                  {i + 1} ·{" "}
                  <T
                    s={
                      s === "walls"
                        ? copy.studio.kitchen.stepWalls
                        : copy.studio.kitchen.stepCabinets
                    }
                  />
                </button>
              ))}
            </div>

            {step === "walls" && (
              <div className="space-y-6">
                <p className="text-[13px] leading-5 text-[var(--aw-muted)]">
                  <T s={copy.studio.kitchen.wallsIntro} />
                </p>

                {/* live plan */}
                <div className="rounded-md border border-[var(--aw-line)] bg-[var(--aw-paper)] p-2">
                  <PlanView
                    project={guarded}
                    layout={layout}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                </div>

                {/* wall chain editor */}
                <ol className="space-y-2">
                  {project.walls.map((wall, i) => {
                    const last = i === project.walls.length - 1;
                    const turn = wall.turn ?? "right";
                    return (
                      <li
                        key={wall.id}
                        className="rounded-md border border-[var(--aw-line)] p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-[family-name:var(--font-aw-serif)] text-base font-semibold">
                            <T s={copy.studio.kitchen.wall} /> {wall.id}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <CommitNumberInput
                              value={wall.length}
                              min={300}
                              max={12000}
                              step={50}
                              onCommit={(length) => setWallLength(wall.id, length)}
                            />
                            <span className="w-6 text-[12px] text-[var(--aw-muted)]">
                              mm
                            </span>
                            <button
                              type="button"
                              onClick={() => removeWall(wall.id)}
                              disabled={project.walls.length <= 1}
                              className={`${iconBtn} h-8 w-8 text-[12px]`}
                              title={copy.studio.kitchen.removeWall.en}
                              aria-label={copy.studio.kitchen.removeWall.en}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        {!last && (
                          <div className="mt-3 flex items-center justify-between gap-2 text-[12px] text-[var(--aw-muted)]">
                            <span>
                              <T s={copy.studio.kitchen.turn} /> → {project.walls[i + 1].id}
                            </span>
                            <div
                              className="grid grid-cols-2 overflow-hidden rounded-md border border-[var(--aw-line)]"
                              role="group"
                            >
                              {(["right", "left"] as const).map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  aria-pressed={turn === t}
                                  onClick={() => setWallTurn(wall.id, t)}
                                  className={`h-8 px-2.5 text-[12px] font-medium transition-colors ${
                                    turn === t
                                      ? "bg-[var(--aw-ink)] text-white"
                                      : "bg-white text-[var(--aw-muted)] hover:text-[var(--aw-ink)]"
                                  }`}
                                  title={
                                    t === "right"
                                      ? copy.studio.kitchen.turnRight.en
                                      : copy.studio.kitchen.turnLeft.en
                                  }
                                >
                                  {t === "right" ? "↱ " : "↰ "}
                                  <T
                                    s={
                                      t === "right"
                                        ? copy.studio.kitchen.turnRight
                                        : copy.studio.kitchen.turnLeft
                                    }
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => insertWallAfter(i)}
                          className="mt-3 h-8 w-full rounded border border-dashed border-[var(--aw-line)] text-[12px] text-[var(--aw-muted)] transition-colors hover:border-[var(--aw-ink)] hover:text-[var(--aw-ink)]"
                        >
                          + <T s={copy.studio.kitchen.insertWallAfter} /> {wall.id}
                        </button>
                      </li>
                    );
                  })}
                </ol>

                <button
                  type="button"
                  onClick={() => setStep("cabinets")}
                  className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[var(--aw-walnut)] text-[13px] font-medium text-white transition-colors hover:bg-[var(--aw-walnut-hover)]"
                >
                  <T s={copy.studio.kitchen.wallsDone} />
                </button>
              </div>
            )}

            {step === "cabinets" && (
            <>
            <div>
              <div className="flex items-baseline justify-between">
                <h2 className={sectionTitle}>
                  <T s={copy.studio.kitchen.walls} />
                </h2>
                <button
                  type="button"
                  onClick={() => setStep("walls")}
                  className="text-[12px] text-[var(--aw-muted)] underline decoration-[var(--aw-line)] underline-offset-4 hover:text-[var(--aw-ink)]"
                >
                  {project.walls.map((w) => w.id).join(" · ")} ·{" "}
                  {project.walls.reduce((s, w) => s + w.length, 0)} mm
                </button>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between gap-2 text-[13px] text-[var(--aw-muted)]">
                  <span>
                    <T s={copy.studio.kitchen.wallHeight} />
                  </span>
                  <div className="flex items-center gap-1.5">
                    <CommitNumberInput
                      value={project.wallHeight}
                      min={1800}
                      max={3600}
                      step={50}
                      onCommit={(wallHeight) =>
                        commit((p) => ({ ...p, wallHeight }), { coalesce: true })
                      }
                    />
                    <span className="w-6 text-[12px]">mm</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-[13px] text-[var(--aw-muted)]">
                  <span>
                    <T s={copy.studio.kitchen.bandHeight} />
                  </span>
                  <div className="flex items-center gap-1.5">
                    <CommitNumberInput
                      value={project.bandGap}
                      min={100}
                      max={1200}
                      step={10}
                      onCommit={(bandGap) =>
                        commit((p) => ({ ...p, bandGap }), { coalesce: true })
                      }
                    />
                    <span className="w-6 text-[12px]">mm</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Per-wall cabinet lists + add buttons, corner rows between */}
            {project.walls.map((wall, wallIndex) => {
              const wallCabinets = layout.cabinets.filter(
                (c) =>
                  c.placement.wallId === wall.id &&
                  c.placement.kind !== "corner",
              );
              const freeFloor = layout.runs.find(
                (r) => r.wallId === wall.id && r.band === "base",
              )?.freeSpace;
              const isOver = typeof freeFloor === "number" && freeFloor < 0;
              const joint = layout.joints.find((j) => j.index === wallIndex);
              const cornerBase = joint?.cornerBase
                ? project.placements.find((p) => p.id === joint.cornerBase)
                : undefined;
              const cornerWall = joint?.cornerWall
                ? project.placements.find((p) => p.id === joint.cornerWall)
                : undefined;
              const cornerRow = (p: Placement | undefined, band: "base" | "wall") =>
                p ? (
                  <div
                    key={band}
                    onClick={() => setSelectedId(p.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSelectedId(p.id);
                      setMenu({ x: e.clientX, y: e.clientY, id: p.id });
                    }}
                    className={`group flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-[13px] transition-colors ${
                      selectedId === p.id
                        ? "border-[var(--aw-walnut)] bg-[var(--aw-paper)] font-medium"
                        : "border-[var(--aw-line)] hover:bg-[var(--aw-paper)]"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="w-7 font-mono font-medium">{p.label}</span>
                      <span className="truncate text-[12px] text-[var(--aw-muted)]">
                        <T
                          s={
                            band === "base"
                              ? copy.studio.kitchen.cornerBase
                              : copy.studio.kitchen.cornerWall
                          }
                        />{" "}
                        · {p.corner?.legA} × {p.corner?.legB}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCabinet(p.id);
                      }}
                      className="p-1 text-[11px] text-[var(--aw-muted)] opacity-0 transition-opacity hover:text-[#9B3B2E] group-hover:opacity-100"
                      aria-label="Remove corner cabinet"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    key={band}
                    type="button"
                    onClick={() => addCorner(wall.id, band)}
                    className="h-8 rounded border border-[var(--aw-line)] bg-white px-2 text-[12px] text-[var(--aw-ink)] transition-colors hover:border-[var(--aw-ink)] hover:bg-[var(--aw-paper)] active:translate-y-px"
                  >
                    +{" "}
                    <T
                      s={
                        band === "base"
                          ? copy.studio.kitchen.cornerBase
                          : copy.studio.kitchen.cornerWall
                      }
                    />
                  </button>
                );
              return (
                <div
                  key={wall.id}
                  className="border-t border-[var(--aw-line)] pt-6"
                >
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-[family-name:var(--font-aw-serif)] text-base font-semibold">
                      <T s={copy.studio.kitchen.wall} /> {wall.id}
                    </h3>
                    <span className="text-[12px] tabular-nums text-[var(--aw-muted)]">
                      {wall.length} mm
                    </span>
                  </div>

                  {typeof freeFloor === "number" && (
                    <div className="mt-2 text-[12px]">
                      <span
                        className={
                          isOver
                            ? "font-medium text-[#9B3B2E]"
                            : "text-[var(--aw-muted)]"
                        }
                      >
                        <T s={copy.studio.kitchen.free} /> ·{" "}
                        <span className="tabular-nums">{freeFloor}</span> mm
                      </span>
                    </div>
                  )}

                  {/* cabinet list for this wall */}
                  <div className="mt-4 divide-y divide-[var(--aw-line)] rounded-md border border-[var(--aw-line)]">
                    {wallCabinets.map((c) => {
                      const p = c.placement;
                      const isSel = p.id === selectedId;
                      const isSpacer = p.kind === "spacer";
                      const isDragging = dragId === p.id;
                      const isOverItem = dragOverId === p.id;
                      return (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={(e) => {
                            setDragId(p.id);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", p.id);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (dragId && dragId !== p.id) setDragOverId(p.id);
                          }}
                          onDragLeave={() => {
                            if (dragOverId === p.id) setDragOverId(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverId(null);
                            const fromId =
                              dragId || e.dataTransfer.getData("text/plain");
                            if (fromId && fromId !== p.id) reorderTo(fromId, p.id);
                            setDragId(null);
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setDragOverId(null);
                          }}
                          onClick={() => setSelectedId(p.id)}
                          onDoubleClick={() => duplicateCabinet(p.id)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setSelectedId(p.id);
                            setMenu({ x: e.clientX, y: e.clientY, id: p.id });
                          }}
                          className={`group flex cursor-pointer items-center justify-between px-3 py-2 text-[13px] transition-colors ${
                            isDragging ? "opacity-30" : ""
                          } ${
                            isOverItem
                              ? "shadow-[inset_0_2px_0_0_var(--aw-walnut)]"
                              : ""
                          } ${
                            isSel
                              ? "bg-[var(--aw-paper)] font-medium"
                              : "hover:bg-[var(--aw-paper)]"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="select-none cursor-grab text-[11px] text-[var(--aw-line)] group-hover:text-[var(--aw-muted)]"
                              title="Drag to reorder"
                            >
                              ⋮⋮
                            </span>
                            <span className="w-7 font-mono font-medium">
                              {p.label}
                            </span>
                            <span
                              className={`truncate text-[12px] ${
                                isSpacer
                                  ? "italic text-[var(--aw-muted)]"
                                  : "text-[var(--aw-muted)]"
                              }`}
                            >
                              {isSpacer
                                ? `${p.params.width} mm`
                                : `${p.params.width} × ${p.params.height}`}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCabinet(p.id);
                            }}
                            className="p-1 text-[11px] text-[var(--aw-muted)] opacity-0 transition-opacity hover:text-[#9B3B2E] group-hover:opacity-100"
                            aria-label="Remove cabinet"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                    {wallCabinets.length === 0 && (
                      <div className="px-3 py-4 text-center text-[12px] text-[var(--aw-muted)]">
                        —
                      </div>
                    )}
                  </div>

                  {/* preset add buttons */}
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    {PRESET_BUTTONS.map((pb) => (
                      <button
                        key={pb.id}
                        type="button"
                        onClick={() => addCabinet(wall.id, pb.id)}
                        className="h-8 truncate rounded border border-[var(--aw-line)] bg-white px-2 text-[12px] text-[var(--aw-ink)] transition-colors hover:border-[var(--aw-ink)] hover:bg-[var(--aw-paper)] active:translate-y-px"
                      >
                        + <T s={pb.label} />
                      </button>
                    ))}
                  </div>

                  {/* corner joint after this wall (inside corners only) */}
                  {joint && (
                    <div className="mt-5 rounded-md border border-dashed border-[var(--aw-line)] p-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--aw-muted)]">
                          <T s={copy.studio.kitchen.cornerAt} /> {joint.wallA} → {joint.wallB}
                        </span>
                        <span className="text-[11px] text-[var(--aw-muted)]">
                          {joint.concave ? "↱" : "↰"}
                        </span>
                      </div>
                      {joint.concave ? (
                        <div className="mt-2 grid grid-cols-1 gap-1.5">
                          {cornerRow(cornerBase, "base")}
                          {cornerRow(cornerWall, "wall")}
                        </div>
                      ) : (
                        <p className="mt-2 text-[12px] text-[var(--aw-muted)]">
                          <T s={copy.studio.kitchen.cornerNeedsInside} />
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            </>
            )}
          </aside>
        )}

        {/* Main 3D Viewport Column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative h-[calc(100vh-210px)] min-h-[580px] w-full overflow-hidden rounded-lg border border-[var(--aw-line)] bg-white shadow-xs">
            <RoomViewport
              ref={viewportRef}
              project={guarded}
              layout={layout}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDragStart={onDragStart3D}
              onDragMove={onDragMove3D}
              onDragEnd={onDragEnd3D}
              view={view}
            />

            {/* camera mode */}
            <div
              className="absolute right-3 bottom-3 grid grid-cols-2 overflow-hidden rounded-md border border-[var(--aw-line)] bg-white/90 text-[11px] backdrop-blur"
              role="group"
            >
              {(["persp", "iso"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`h-7 px-2.5 font-medium transition-colors ${
                    view === v
                      ? "bg-[var(--aw-ink)] text-white"
                      : "text-[var(--aw-muted)] hover:text-[var(--aw-ink)]"
                  }`}
                >
                  <T
                    s={
                      v === "iso"
                        ? copy.studio.kitchen.viewIso
                        : copy.studio.kitchen.viewPersp
                    }
                  />
                </button>
              ))}
            </div>

            {/* navigation hint */}
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/80 px-2.5 py-1 text-[11px] text-[var(--aw-muted)] backdrop-blur">
              <T s={copy.studio.kitchen.navHint} />
            </div>

            {/* measurements popup — floats like a Figma panel, drag its header */}
            {selected && (
              <div
                ref={popupRef}
                style={
                  popupPos ? { left: popupPos.x, top: popupPos.y } : undefined
                }
                className={`aw-pop ${
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
                  onDoubleClick={() => setPopupPos(null)}
                  title="Drag to move · double-click to dock"
                >
                  <div>
                    <span className="text-[15px] font-semibold">
                      {selected.label}
                    </span>
                    <span className="ml-2 text-[13px] tabular-nums text-[var(--aw-muted)]">
                      {selected.kind === "spacer"
                        ? selected.params.width
                        : selected.kind === "corner" && selected.corner
                          ? `${selected.corner.legA} × ${selected.corner.legB} × ${selected.params.height}`
                          : `${selected.params.width} × ${selected.params.height} × ${selected.params.depth}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="close"
                    onClick={() => setSelectedId(null)}
                    className="ml-3 h-7 w-7 rounded-md border border-[var(--aw-line)] text-[12px] text-[var(--aw-muted)] transition-colors hover:text-[var(--aw-ink)]"
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
                ) : selected.kind === "corner" && selected.corner ? (
                  <CornerForm
                    params={selected.params}
                    corner={selected.corner}
                    band={selected.band === "wall" ? "wall" : "base"}
                    wallA={selected.wallId}
                    wallB={
                      layout.joints.find((j) => j.wallA === selected.wallId)
                        ?.wallB ?? ""
                    }
                    onParams={updateSelectedParams}
                    onCorner={updateSelectedCorner}
                  />
                ) : (
                  <CabinetForm
                    params={selected.params}
                    errors={selectedErrors}
                    onChange={updateSelectedParams}
                  />
                )}
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => duplicateCabinet(selected.id)}
                    disabled={selected.kind === "corner"}
                    className="h-9 rounded-md border border-[var(--aw-line)] text-[13px] font-medium transition-colors hover:border-[var(--aw-ink)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <T s={copy.studio.kitchen.duplicate} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCabinet(selected.id)}
                    className="h-9 rounded-md border border-[var(--aw-line)] text-[13px] font-medium text-[#9B3B2E] transition-colors hover:border-[#9B3B2E]"
                  >
                    <T s={copy.studio.kitchen.remove} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <LayoutModal
          isOpen={isLayoutOpen}
          onClose={() => setIsLayoutOpen(false)}
          project={guarded}
          layout={layout}
          selectedId={selectedId}
          onSelect={setSelectedId}
          allPanels={allPanels}
          allHardware={allHardware}
          onExportPdf={startPdf}
          exportProgress={exportProgress}
        />
      </div>
    </div>
  );
}
