import { LIMITS } from "../cabinet/solve";
import type {
  CabinetParams,
  HardwareItem,
  Panel,
  PanelRole,
} from "../cabinet/types";
import { WALL_STANDOFF } from "./presets";
import type { CornerParams } from "./types";

/**
 * Corner cabinets live in the CORNER-LOCAL frame: the origin is the corner
 * point (where the two wall faces meet), local +x runs along wall B (the
 * wall AFTER the joint), local +z runs back along wall A (the wall BEFORE
 * the joint). Wall A's face is the plane x = 0 (z ≥ 0), wall B's face is
 * the plane z = 0 (x ≥ 0), the room is x > 0, z > 0. Heights are y.
 *
 * Unlike regular cabinets the panels INCLUDE the wall standoff `s`
 * themselves — the placed cabinet's world origin is exactly the corner
 * point. Legs are measured from the corner point and include `s` too.
 */

/** Smallest usable door width for the blind style */
export const CORNER_MIN_DOOR = 100;

/** Extra room a leg needs beyond the carcass depth to be buildable */
const LEG_MARGIN = 100;

/** Legs clamped to the smallest buildable size for the style. */
export function clampCorner(
  params: CabinetParams,
  corner: CornerParams,
): CornerParams {
  const s = WALL_STANDOFF;
  const d = params.depth;
  const minA = s + d + LEG_MARGIN;
  const minB = corner.style === "diagonal" ? s + d + LEG_MARGIN : s + d;
  return {
    legA: Math.max(minA, corner.legA),
    legB: Math.max(minB, corner.legB),
    style: corner.style,
  };
}

type Range = [number, number];
type Pt = [number, number];

const hingesFor = (carcassHeight: number): number =>
  carcassHeight < 900 ? 2 : carcassHeight < 1600 ? 3 : 4;

/** Every panel of a corner cabinet, in the corner-local frame. */
export function solveCorner(
  params: CabinetParams,
  cornerIn: CornerParams,
): Panel[] {
  const corner = clampCorner(params, cornerIn);
  const s = WALL_STANDOFF;
  const d = params.depth;
  const A = corner.legA;
  const B = corner.legB;
  const t = params.thickness;
  const bt = params.backThickness;
  const ph = params.plinthHeight;
  const H = params.height;
  const hc = H - ph;
  const r = params.reveal;
  const ft = params.frontThickness;
  const sb = params.shelfSetback;
  const midY = ph + hc / 2;
  const panels: Panel[] = [];

  const push = (
    id: string,
    role: PanelRole,
    size: Panel["size"],
    position: Panel["position"],
    cut: Panel["cut"],
    extra: { decor?: string; rotY?: number; polygon?: Pt[] } = {},
  ) => {
    const panel: Panel = {
      id,
      role,
      size,
      position,
      cut,
      decor: extra.decor ?? params.carcassDecor,
    };
    if (extra.rotY !== undefined) panel.rotY = extra.rotY;
    if (extra.polygon) panel.polygon = extra.polygon;
    panels.push(panel);
  };

  /** Axis-aligned box from three coordinate ranges. */
  const box = (
    id: string,
    role: PanelRole,
    xr: Range,
    yr: Range,
    zr: Range,
    cut: Panel["cut"],
    decor?: string,
  ) =>
    push(
      id,
      role,
      { x: xr[1] - xr[0], y: yr[1] - yr[0], z: zr[1] - zr[0] },
      {
        x: (xr[0] + xr[1]) / 2,
        y: (yr[0] + yr[1]) / 2,
        z: (zr[0] + zr[1]) / 2,
      },
      cut,
      { decor },
    );

  /** Horizontal polygon panel `t` thick centred on `y`, with bbox size. */
  const slab = (id: string, role: PanelRole, polygon: Pt[], y: number) => {
    const xs = polygon.map((p) => p[0]);
    const zs = polygon.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const z0 = Math.min(...zs);
    const z1 = Math.max(...zs);
    push(
      id,
      role,
      { x: x1 - x0, y: t, z: z1 - z0 },
      { x: (x0 + x1) / 2, y, z: (z0 + z1) / 2 },
      { length: x1 - x0, width: z1 - z0, thickness: t },
      { polygon },
    );
  };

  // shelves spaced evenly in the clear interior, like solveCabinet
  const shelfYs: number[] = [];
  {
    const interiorBottom = ph + t;
    const interiorHeight = hc - 2 * t;
    const n = Math.max(0, Math.floor(params.shelfCount));
    const gap = (interiorHeight - n * t) / (n + 1);
    for (let i = 0; i < n; i++) {
      shelfYs.push(interiorBottom + (i + 1) * gap + i * t + t / 2);
    }
  }

  const carcassY: Range = [ph, H];

  if (corner.style === "diagonal") {
    // backs along both walls — grain vertical
    box("back-a", "back", [s - bt, s], carcassY, [s, A], {
      length: hc,
      width: A - s,
      thickness: bt,
    });
    box("back-b", "back", [s, B], carcassY, [s - bt, s], {
      length: hc,
      width: B - s,
      thickness: bt,
    });
    // sides at the ends of the legs
    box("side-left", "side-left", [s, s + d], carcassY, [A - t, A], {
      length: hc,
      width: d,
      thickness: t,
    });
    box("side-right", "side-right", [B - t, B], carcassY, [s, s + d], {
      length: hc,
      width: d,
      thickness: t,
    });
    // pentagon bottom / top
    const outline: Pt[] = [
      [s, s],
      [B - t, s],
      [B - t, s + d],
      [s + d, A - t],
      [s, A - t],
    ];
    slab("bottom", "bottom", outline, ph + t / 2);
    slab("top", "top", outline, H - t / 2);
    // shelves, set back from the front edge
    const shelfOutline: Pt[] = [
      [s, s],
      [B - t, s],
      [B - t, s + d - sb],
      [s + d - sb, A - t],
      [s, A - t],
    ];
    shelfYs.forEach((y, i) => slab(`shelf-${i + 1}`, "shelf", shelfOutline, y));

    // diagonal door between the front-inner points of the two sides
    const P = { x: B - t, z: s + d };
    const Q = { x: s + d, z: A - t };
    const L = Math.hypot(P.x - Q.x, P.z - Q.z);
    const u = { x: (P.x - Q.x) / L, z: (P.z - Q.z) / L };
    const n = { x: -u.z, z: u.x };
    if (n.x + n.z <= 0) throw new Error("corner door normal points into the corner");
    const mid = { x: (P.x + Q.x) / 2, z: (P.z + Q.z) / 2 };
    const rotY = Math.atan2(-u.z, u.x);
    push(
      "door-1",
      "door",
      { x: L - 2 * r, y: hc - 2 * r, z: ft },
      { x: mid.x + n.x * (ft / 2), y: midY, z: mid.z + n.z * (ft / 2) },
      { length: hc - 2 * r, width: L - 2 * r, thickness: ft },
      { decor: params.frontDecor, rotY },
    );
    // plinth rail parallel to the door, recessed for the toe kick
    if (ph > 0) {
      const back = LIMITS.plinthRecess + t / 2;
      push(
        "plinth",
        "plinth",
        { x: L - 100, y: ph, z: t },
        { x: mid.x - n.x * back, y: ph / 2, z: mid.z - n.z * back },
        { length: L - 100, width: ph, thickness: t },
        { rotY },
      );
    }
    return panels;
  }

  // BLIND: one box along wall A, door on the part beyond leg B, blind
  // panel over the dead part next to wall B
  const boxX: Range = [s, s + d];
  box("side-left", "side-left", boxX, carcassY, [s, s + t], {
    length: hc,
    width: d,
    thickness: t,
  });
  box("side-right", "side-right", boxX, carcassY, [A - t, A], {
    length: hc,
    width: d,
    thickness: t,
  });
  const innerZ: Range = [s + t, A - t];
  const innerLen = A - s - 2 * t;
  box("bottom", "bottom", boxX, [ph, ph + t], innerZ, {
    length: innerLen,
    width: d,
    thickness: t,
  });
  box("top", "top", boxX, [H - t, H], innerZ, {
    length: innerLen,
    width: d,
    thickness: t,
  });
  box("back", "back", [s - bt, s], carcassY, [s, A], {
    length: hc,
    width: A - s,
    thickness: bt,
  });
  shelfYs.forEach((y, i) =>
    box(`shelf-${i + 1}`, "shelf", [s, s + d - sb], [y - t / 2, y + t / 2], innerZ, {
      length: innerLen,
      width: d - sb,
      thickness: t,
    }),
  );
  if (ph > 0) {
    const frontX = s + d - LIMITS.plinthRecess;
    box("plinth", "plinth", [frontX - t, frontX], [0, ph], innerZ, {
      length: innerLen,
      width: ph,
      thickness: t,
    });
  }
  // fronts on the plane x = s + d
  const frontX: Range = [s + d, s + d + ft];
  const frontY: Range = [ph + r, H - r];
  const doorWidth = A - B - 2 * r;
  if (doorWidth >= CORNER_MIN_DOOR) {
    box(
      "door-1",
      "door",
      frontX,
      frontY,
      [B + r, A - r],
      { length: hc - 2 * r, width: doorWidth, thickness: ft },
      params.frontDecor,
    );
  }
  box(
    "blind-panel",
    "blind-panel",
    frontX,
    frontY,
    [s + r, B - r],
    { length: hc - 2 * r, width: B - s - 2 * r, thickness: ft },
    params.frontDecor,
  );
  return panels;
}

/** Plan footprint polygon (corner-local x, z) the cabinet occupies. */
export function cornerFootprint(
  params: CabinetParams,
  cornerIn: CornerParams,
): Array<[number, number]> {
  const { legA: A, legB: B, style } = clampCorner(params, cornerIn);
  const s = WALL_STANDOFF;
  const d = params.depth;
  if (style === "diagonal") {
    return [
      [s, s],
      [B, s],
      [B, s + d],
      [s + d, A],
      [s, A],
    ];
  }
  return [
    [s, s],
    [s + d, s],
    [s + d, A],
    [s, A],
  ];
}

/** Hinges implied by the corner door. */
export function countCornerHardware(
  params: CabinetParams,
  cornerIn: CornerParams,
): HardwareItem[] {
  const { legA: A, legB: B, style } = clampCorner(params, cornerIn);
  const hc = params.height - params.plinthHeight;
  const hasDoor =
    style === "diagonal" || A - B - 2 * params.reveal >= CORNER_MIN_DOOR;
  if (!hasDoor) return [];
  return [{ kind: "hinge", spec: "", qty: hingesFor(hc) }];
}
