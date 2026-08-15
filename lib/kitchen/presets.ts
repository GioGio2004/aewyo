import type { CabinetParams } from "../cabinet/types";
import type { Band } from "./types";

export type PresetId =
  | "base-doors"
  | "base-drawers"
  | "sink-base"
  | "oven-base"
  | "hob-base"
  | "fridge-tall"
  | "wall-unit"
  | "tall-unit"
  | "hood-unit"
  | "space";

export const PRESET_BAND: Record<PresetId, Band> = {
  "base-doors": "base",
  "base-drawers": "base",
  "sink-base": "base",
  "oven-base": "base",
  "hob-base": "base",
  "fridge-tall": "tall",
  "wall-unit": "wall",
  "tall-unit": "tall",
  "hood-unit": "wall",
  space: "base",
};

export const PRESET_KIND: Record<PresetId, "cabinet" | "spacer"> = {
  "base-doors": "cabinet",
  "base-drawers": "cabinet",
  "sink-base": "cabinet",
  "oven-base": "cabinet",
  "hob-base": "cabinet",
  "fridge-tall": "cabinet",
  "wall-unit": "cabinet",
  "tall-unit": "cabinet",
  "hood-unit": "cabinet",
  space: "spacer",
};

export const LABEL_PREFIX: Record<Band, string> = {
  base: "K",
  wall: "W",
  tall: "T",
};

const common = {
  thickness: 18,
  backThickness: 4,
  shelfSetback: 20,
  reveal: 3,
  frontThickness: 18,
  carcassDecor: "oak",
  drawerCount: 3,
} as const;

export const PRESETS: Record<PresetId, CabinetParams> = {
  "base-doors": {
    ...common,
    width: 600,
    height: 870,
    depth: 560,
    shelfCount: 1,
    plinthHeight: 100,
    front: "doors",
    doorCount: 1,
    frontDecor: "stone-grey",
  },
  "base-drawers": {
    ...common,
    width: 600,
    height: 870,
    depth: 560,
    shelfCount: 0,
    plinthHeight: 100,
    front: "drawers",
    doorCount: 1,
    frontDecor: "stone-grey",
  },
  "sink-base": {
    ...common,
    width: 800,
    height: 870,
    depth: 560,
    shelfCount: 0,
    plinthHeight: 100,
    front: "doors",
    doorCount: 2,
    frontDecor: "stone-grey",
    appliance: "sink",
  },
  "oven-base": {
    ...common,
    width: 600,
    height: 870,
    depth: 560,
    shelfCount: 0,
    plinthHeight: 100,
    front: "none",
    doorCount: 1,
    frontDecor: "stone-grey",
    appliance: "oven",
  },
  "hob-base": {
    ...common,
    width: 600,
    height: 870,
    depth: 560,
    shelfCount: 0,
    plinthHeight: 100,
    front: "drawers",
    doorCount: 1,
    frontDecor: "stone-grey",
    appliance: "hob",
  },
  "fridge-tall": {
    ...common,
    width: 700,
    height: 2100,
    depth: 560,
    shelfCount: 0,
    plinthHeight: 100,
    front: "none",
    doorCount: 1,
    frontDecor: "stone-grey",
    appliance: "fridge",
  },
  "hood-unit": {
    ...common,
    width: 600,
    height: 350,
    depth: 320,
    shelfCount: 0,
    plinthHeight: 0,
    front: "none",
    doorCount: 1,
    frontDecor: "stone-grey",
    appliance: "hood",
  },
  space: {
    ...common,
    width: 600,
    height: 870,
    depth: 560,
    shelfCount: 0,
    plinthHeight: 0,
    front: "none",
    doorCount: 1,
    frontDecor: "oak",
  },
  "wall-unit": {
    ...common,
    width: 600,
    height: 720,
    depth: 320,
    shelfCount: 2,
    plinthHeight: 0,
    front: "doors",
    doorCount: 1,
    frontDecor: "walnut",
  },
  "tall-unit": {
    ...common,
    width: 600,
    height: 2100,
    depth: 560,
    shelfCount: 4,
    plinthHeight: 100,
    front: "doors",
    doorCount: 1,
    frontDecor: "stone-grey",
  },
};

/** Default clear gap between countertop and wall-cabinet bottoms */
export const DEFAULT_BAND_GAP = 560;

/** Reference counter height when a wall has no base cabinets */
export const DEFAULT_BASE_HEIGHT = 870;

/** Countertop thickness */
export const COUNTER_THICKNESS = 40;

/** Countertop front overhang past the cabinet fronts */
export const COUNTER_OVERHANG = 20;

/** Clearance between a corner run start and the previous wall's cabinets */
export const CORNER_CLEARANCE = 20;

/** Gap between the wall face and cabinet backs (services + no z-fighting) */
export const WALL_STANDOFF = 20;

/** Corner cabinet defaults per band (legs measured from the corner point) */
export const CORNER_BASE_DEFAULTS = {
  legA: 900,
  legB: 900,
  style: "diagonal" as const,
};
export const CORNER_WALL_DEFAULTS = {
  legA: 600,
  legB: 600,
  style: "diagonal" as const,
};

/** CabinetParams used for corner placements (width is informational = legA) */
export const CORNER_PARAMS: Record<"base" | "wall", CabinetParams> = {
  base: {
    ...common,
    width: 900,
    height: 870,
    depth: 560,
    shelfCount: 1,
    plinthHeight: 100,
    front: "doors",
    doorCount: 1,
    frontDecor: "stone-grey",
  },
  wall: {
    ...common,
    width: 600,
    height: 720,
    depth: 320,
    shelfCount: 2,
    plinthHeight: 0,
    front: "doors",
    doorCount: 1,
    frontDecor: "walnut",
  },
};

/** Workshop label prefix for corner placements */
export const CORNER_LABEL_PREFIX = "C";
