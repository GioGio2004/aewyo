import { DECORS } from "./decors";
import type {
  CabinetParams,
  HardwareItem,
  Panel,
  PanelRole,
  ValidationError,
} from "./types";

export const DEFAULT_PARAMS: CabinetParams = {
  width: 800,
  height: 2000,
  depth: 350,
  thickness: 18,
  backThickness: 4,
  shelfCount: 4,
  plinthHeight: 80,
  shelfSetback: 20,
  front: "doors",
  doorCount: 2,
  drawerCount: 3,
  reveal: 3,
  frontThickness: 18,
  carcassDecor: "oak",
  frontDecor: "walnut",
};

export const LIMITS = {
  width: { min: 200, max: 2400 },
  height: { min: 300, max: 2600 },
  depth: { min: 100, max: 800 },
  thickness: { min: 12, max: 25 },
  backThickness: { min: 3, max: 18 },
  shelfCount: { min: 0, max: 12 },
  plinthHeight: { min: 0, max: 200 },
  shelfSetback: { min: 0, max: 60 },
  doorCount: { min: 1, max: 3 },
  drawerCount: { min: 1, max: 6 },
  reveal: { min: 2, max: 6 },
  frontThickness: { min: 12, max: 25 },
  /** Minimum clear opening between shelves */
  minShelfGap: 60,
  /** Toe-kick recess of the plinth rail from the front edge */
  plinthRecess: 50,
  /** Sensible hinge-side door width range */
  doorWidth: { min: 200, max: 600 },
  /** Minimum drawer front height */
  minDrawerFront: 90,
  /** Side-mount slide clearance per side */
  slideClearance: 13,
  /** Drawer box stops this short of the carcass depth */
  boxDepthClearance: 50,
} as const;

const rangeChecks: Array<{
  field: keyof CabinetParams;
  limit: { min: number; max: number };
  label: { ka: string; en: string };
  integer?: boolean;
}> = [
  { field: "width", limit: LIMITS.width, label: { ka: "სიგანე", en: "Width" } },
  {
    field: "height",
    limit: LIMITS.height,
    label: { ka: "სიმაღლე", en: "Height" },
  },
  { field: "depth", limit: LIMITS.depth, label: { ka: "სიღრმე", en: "Depth" } },
  {
    field: "thickness",
    limit: LIMITS.thickness,
    label: { ka: "მასალის სისქე", en: "Material thickness" },
  },
  {
    field: "backThickness",
    limit: LIMITS.backThickness,
    label: { ka: "ზურგის სისქე", en: "Back thickness" },
  },
  {
    field: "shelfCount",
    limit: LIMITS.shelfCount,
    label: { ka: "თაროების რაოდენობა", en: "Shelf count" },
    integer: true,
  },
  {
    field: "plinthHeight",
    limit: LIMITS.plinthHeight,
    label: { ka: "ცოკოლის სიმაღლე", en: "Plinth height" },
  },
  {
    field: "shelfSetback",
    limit: LIMITS.shelfSetback,
    label: { ka: "თაროს უკუწევა", en: "Shelf setback" },
  },
  {
    field: "doorCount",
    limit: LIMITS.doorCount,
    label: { ka: "კარების რაოდენობა", en: "Door count" },
    integer: true,
  },
  {
    field: "drawerCount",
    limit: LIMITS.drawerCount,
    label: { ka: "უჯრების რაოდენობა", en: "Drawer count" },
    integer: true,
  },
  {
    field: "reveal",
    limit: LIMITS.reveal,
    label: { ka: "ღრეჩო", en: "Reveal" },
  },
  {
    field: "frontThickness",
    limit: LIMITS.frontThickness,
    label: { ka: "ფასადის სისქე", en: "Front thickness" },
  },
];

export function validate(p: CabinetParams): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const { field, limit, label, integer } of rangeChecks) {
    const value = p[field] as number;
    if (!Number.isFinite(value) || value < limit.min || value > limit.max) {
      errors.push({
        field,
        message: {
          ka: `${label.ka}: ${limit.min}–${limit.max} ფარგლებში`,
          en: `${label.en}: must be within ${limit.min}–${limit.max}`,
        },
      });
    } else if (integer && !Number.isInteger(value)) {
      errors.push({
        field,
        message: {
          ka: `${label.ka} მთელი რიცხვია`,
          en: `${label.en} must be a whole number`,
        },
      });
    }
  }
  for (const field of ["carcassDecor", "frontDecor"] as const) {
    if (!DECORS.some((d) => d.id === p[field])) {
      errors.push({
        field,
        message: { ka: "უცნობი დეკორი", en: "Unknown decor" },
      });
    }
  }
  if (errors.length > 0) return errors;

  const carcassHeight = p.height - p.plinthHeight;

  if (p.front !== "drawers") {
    const interiorHeight = carcassHeight - 2 * p.thickness;
    const gap =
      (interiorHeight - p.shelfCount * p.thickness) / (p.shelfCount + 1);
    if (gap < LIMITS.minShelfGap) {
      errors.push({
        field: "shelfCount",
        message: {
          ka: `ამ სიმაღლეზე მაქსიმუმ ${maxShelves(p)} თარო ეტევა`,
          en: `At this height at most ${maxShelves(p)} shelves fit`,
        },
      });
    }
  }
  if (p.front === "doors") {
    const doorWidth =
      (p.width - (p.doorCount + 1) * p.reveal) / p.doorCount;
    if (doorWidth > LIMITS.doorWidth.max) {
      errors.push({
        field: "doorCount",
        message: {
          ka: `${Math.round(doorWidth)} მმ კარი ძალიან განიერია — დაამატე კარი`,
          en: `A ${Math.round(doorWidth)} mm door is too wide — add a door`,
        },
      });
    } else if (doorWidth < LIMITS.doorWidth.min) {
      errors.push({
        field: "doorCount",
        message: {
          ka: `${Math.round(doorWidth)} მმ კარი ძალიან ვიწროა — მოაკელი კარი`,
          en: `A ${Math.round(doorWidth)} mm door is too narrow — remove a door`,
        },
      });
    }
  }
  if (p.front === "drawers") {
    const frontHeight =
      (carcassHeight - (p.drawerCount + 1) * p.reveal) / p.drawerCount;
    if (frontHeight < LIMITS.minDrawerFront) {
      errors.push({
        field: "drawerCount",
        message: {
          ka: `ამ სიმაღლეზე მაქსიმუმ ${maxDrawers(p)} უჯრა ეტევა`,
          en: `At this height at most ${maxDrawers(p)} drawers fit`,
        },
      });
    }
  }
  if (p.width - 2 * p.thickness <= 0) {
    errors.push({
      field: "width",
      message: {
        ka: "სიგანე ძალიან მცირეა მასალის სისქესთან",
        en: "Width is too small for the material thickness",
      },
    });
  }
  return errors;
}

export function maxShelves(p: CabinetParams): number {
  const interiorHeight = p.height - p.plinthHeight - 2 * p.thickness;
  const count = Math.floor(
    (interiorHeight - LIMITS.minShelfGap) /
      (p.thickness + LIMITS.minShelfGap),
  );
  return Math.max(0, Math.min(LIMITS.shelfCount.max, count));
}

export function maxDrawers(p: CabinetParams): number {
  const carcassHeight = p.height - p.plinthHeight;
  const count = Math.floor(
    (carcassHeight - p.reveal) / (LIMITS.minDrawerFront + p.reveal),
  );
  return Math.max(0, Math.min(LIMITS.drawerCount.max, count));
}

/**
 * The deterministic engine: params in, every panel out.
 * Construction (frameless, full-overlay fronts):
 * - sides run the full carcass height and carry top/bottom between them
 * - thin back overlays the carcass rear (z < 0)
 * - shelves sit between the sides, set back from the front edge
 * - plinth is a single front rail between the sides, recessed for a toe kick
 * - fronts overlay the carcass face inset by `reveal` at the outer edges,
 *   with a `reveal` gap between adjacent fronts, sitting proud of the carcass
 * - each drawer front carries a box on side-mount slides behind it
 */
export function solveCabinet(p: CabinetParams): Panel[] {
  const t = p.thickness;
  const carcassHeight = p.height - p.plinthHeight;
  const innerWidth = p.width - 2 * t;
  const shelfDepth = p.depth - p.shelfSetback;
  const panels: Panel[] = [];

  const box = (
    id: string,
    role: PanelRole,
    size: Panel["size"],
    position: Panel["position"],
    cut: { length: number; width: number },
    thickness: number = t,
    decor: string = p.carcassDecor,
  ) => {
    panels.push({ id, role, size, position, cut: { ...cut, thickness }, decor });
  };

  // sides — grain runs vertically
  box(
    "side-left",
    "side-left",
    { x: t, y: carcassHeight, z: p.depth },
    { x: t / 2, y: p.plinthHeight + carcassHeight / 2, z: p.depth / 2 },
    { length: carcassHeight, width: p.depth },
  );
  box(
    "side-right",
    "side-right",
    { x: t, y: carcassHeight, z: p.depth },
    {
      x: p.width - t / 2,
      y: p.plinthHeight + carcassHeight / 2,
      z: p.depth / 2,
    },
    { length: carcassHeight, width: p.depth },
  );

  // bottom + top between the sides — grain runs along the width
  box(
    "bottom",
    "bottom",
    { x: innerWidth, y: t, z: p.depth },
    { x: p.width / 2, y: p.plinthHeight + t / 2, z: p.depth / 2 },
    { length: innerWidth, width: p.depth },
  );
  box(
    "top",
    "top",
    { x: innerWidth, y: t, z: p.depth },
    { x: p.width / 2, y: p.plinthHeight + carcassHeight - t / 2, z: p.depth / 2 },
    { length: innerWidth, width: p.depth },
  );

  // shelves, evenly spaced in the clear interior (not with drawers)
  if (p.front !== "drawers") {
    const interiorBottom = p.plinthHeight + t;
    const interiorHeight = carcassHeight - 2 * t;
    const gap = (interiorHeight - p.shelfCount * t) / (p.shelfCount + 1);
    for (let i = 0; i < p.shelfCount; i++) {
      const centerY = interiorBottom + (i + 1) * gap + i * t + t / 2;
      box(
        `shelf-${i + 1}`,
        "shelf",
        { x: innerWidth, y: t, z: shelfDepth },
        { x: p.width / 2, y: centerY, z: shelfDepth / 2 },
        { length: innerWidth, width: shelfDepth },
      );
    }
  }

  // back — thin overlay behind the carcass, grain vertical
  box(
    "back",
    "back",
    { x: p.width, y: carcassHeight, z: p.backThickness },
    {
      x: p.width / 2,
      y: p.plinthHeight + carcassHeight / 2,
      z: -p.backThickness / 2,
    },
    { length: carcassHeight, width: p.width },
    p.backThickness,
  );

  // plinth rail, recessed from the front
  if (p.plinthHeight > 0) {
    box(
      "plinth",
      "plinth",
      { x: innerWidth, y: p.plinthHeight, z: t },
      {
        x: p.width / 2,
        y: p.plinthHeight / 2,
        z: p.depth - LIMITS.plinthRecess - t / 2,
      },
      { length: innerWidth, width: p.plinthHeight },
    );
  }

  // fronts
  const frontZ = p.depth + p.frontThickness / 2;

  if (p.front === "doors") {
    const doorWidth =
      (p.width - (p.doorCount + 1) * p.reveal) / p.doorCount;
    const doorHeight = carcassHeight - 2 * p.reveal;
    for (let i = 0; i < p.doorCount; i++) {
      const centerX = p.reveal + i * (doorWidth + p.reveal) + doorWidth / 2;
      box(
        `door-${i + 1}`,
        "door",
        { x: doorWidth, y: doorHeight, z: p.frontThickness },
        { x: centerX, y: p.plinthHeight + carcassHeight / 2, z: frontZ },
        { length: doorHeight, width: doorWidth },
        p.frontThickness,
        p.frontDecor,
      );
    }
  }

  if (p.front === "drawers") {
    const n = p.drawerCount;
    const frontHeight = (carcassHeight - (n + 1) * p.reveal) / n;
    const frontWidth = p.width - 2 * p.reveal;
    const boxOuterW = innerWidth - 2 * LIMITS.slideClearance;
    const boxDepth = p.depth - LIMITS.boxDepthClearance;
    const boxZ0 = 10;
    const interiorBottom = p.plinthHeight + t;

    for (let i = 0; i < n; i++) {
      const frontBottom = p.plinthHeight + p.reveal + i * (frontHeight + p.reveal);
      box(
        `drawer-front-${i + 1}`,
        "drawer-front",
        { x: frontWidth, y: frontHeight, z: p.frontThickness },
        { x: p.width / 2, y: frontBottom + frontHeight / 2, z: frontZ },
        { length: frontWidth, width: frontHeight },
        p.frontThickness,
        p.frontDecor,
      );

      const boxHeight = Math.min(
        200,
        Math.max(70, Math.round((frontHeight - 40) / 10) * 10),
      );
      const boxBottom = Math.max(frontBottom, interiorBottom) + 10;
      const boxLeft = t + LIMITS.slideClearance;

      // box sides — grain along the depth
      for (const [side, x] of [
        ["l", boxLeft + t / 2],
        ["r", boxLeft + boxOuterW - t / 2],
      ] as const) {
        box(
          `drawer-${i + 1}-side-${side}`,
          "drawer-side",
          { x: t, y: boxHeight, z: boxDepth },
          { x, y: boxBottom + boxHeight / 2, z: boxZ0 + boxDepth / 2 },
          { length: boxDepth, width: boxHeight },
        );
      }
      // box front + back rails between the sides
      for (const [rail, z] of [
        ["back", boxZ0 + t / 2],
        ["front", boxZ0 + boxDepth - t / 2],
      ] as const) {
        box(
          `drawer-${i + 1}-rail-${rail}`,
          "drawer-rail",
          { x: boxOuterW - 2 * t, y: boxHeight, z: t },
          { x: p.width / 2, y: boxBottom + boxHeight / 2, z },
          { length: boxOuterW - 2 * t, width: boxHeight },
        );
      }
      // thin bottom overlaid under the box
      box(
        `drawer-${i + 1}-bottom`,
        "drawer-bottom",
        { x: boxOuterW, y: p.backThickness, z: boxDepth },
        {
          x: p.width / 2,
          y: boxBottom - p.backThickness / 2,
          z: boxZ0 + boxDepth / 2,
        },
        { length: boxDepth, width: boxOuterW },
        p.backThickness,
      );
    }
  }

  return panels;
}

/** Hinges and slides implied by the fronts. */
export function countHardware(p: CabinetParams): HardwareItem[] {
  const items: HardwareItem[] = [];
  const carcassHeight = p.height - p.plinthHeight;

  if (p.front === "doors") {
    const doorHeight = carcassHeight - 2 * p.reveal;
    const perDoor =
      doorHeight < 900 ? 2 : doorHeight < 1600 ? 3 : doorHeight < 2000 ? 4 : 5;
    items.push({ kind: "hinge", spec: "", qty: perDoor * p.doorCount });
  }
  if (p.front === "drawers") {
    const boxDepth = p.depth - LIMITS.boxDepthClearance;
    const slideLength = Math.min(
      550,
      Math.max(250, Math.floor(boxDepth / 50) * 50),
    );
    items.push({
      kind: "slide-pair",
      spec: `${slideLength} mm`,
      qty: p.drawerCount,
    });
  }
  return items;
}
