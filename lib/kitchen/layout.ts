import { solveCabinet } from "../cabinet/solve";
import { clampCorner, cornerFootprint, solveCorner } from "./corner";
import {
  CORNER_BASE_DEFAULTS,
  CORNER_CLEARANCE,
  CORNER_WALL_DEFAULTS,
  COUNTER_OVERHANG,
  COUNTER_THICKNESS,
  DEFAULT_BAND_GAP,
  DEFAULT_BASE_HEIGHT,
  WALL_STANDOFF,
} from "./presets";
import type {
  CornerStyle,
  CounterSlab,
  JointInfo,
  KitchenLayout,
  KitchenProject,
  PlacedCabinet,
  Placement,
  WallFrame,
  WallRunInfo,
} from "./types";

export type { WallFrame } from "./types";

type Vec = { x: number; z: number };

// Turning "right" (into the room) from dir; `+ 0` folds -0 into 0 so the
// rotY of a wall running along -x is a stable -π.
const rotRight = (d: Vec): Vec => ({ x: -d.z + 0, z: d.x + 0 });
const rotLeft = (d: Vec): Vec => ({ x: d.z + 0, z: -d.x + 0 });

/**
 * Walls chain from the room origin: the first runs along +x with the room
 * on its +z side; each next wall starts where the previous one ends,
 * rotated by the previous wall's turn ("right" = into the room, concave
 * corner; "left" = away, convex corner). dir = along the wall, normal =
 * into the room, rotY = three.js Y rotation mapping local +x → dir.
 */
export function wallFrames(project: KitchenProject): Map<string, WallFrame> {
  const frames = new Map<string, WallFrame>();
  const walls = project.walls;
  let origin: Vec = { x: 0, z: 0 };
  let dir: Vec = { x: 1, z: 0 };
  walls.forEach((wall, i) => {
    if (i > 0) {
      const prevTurn = walls[i - 1].turn ?? "right";
      dir = prevTurn === "left" ? rotLeft(dir) : rotRight(dir);
    }
    const normal = rotRight(dir);
    const end: Vec = {
      x: origin.x + dir.x * wall.length,
      z: origin.z + dir.z * wall.length,
    };
    frames.set(wall.id, {
      id: wall.id,
      index: i,
      origin,
      end,
      dir,
      normal,
      rotY: Math.atan2(-dir.z, dir.x),
      turn: i < walls.length - 1 ? (wall.turn ?? "right") : undefined,
    });
    origin = end;
  });
  return frames;
}

const isCornerOf = (p: Placement, wallId: string, band: "base" | "wall") =>
  p.kind === "corner" && p.wallId === wallId && p.band === band;

/** One joint per consecutive wall pair, with the corner cabinets on it. */
export function joints(project: KitchenProject): JointInfo[] {
  const frames = wallFrames(project);
  const result: JointInfo[] = [];
  for (let i = 0; i < project.walls.length - 1; i++) {
    const wallA = project.walls[i];
    const wallB = project.walls[i + 1];
    const frame = frames.get(wallA.id)!;
    result.push({
      index: i,
      wallA: wallA.id,
      wallB: wallB.id,
      concave: (wallA.turn ?? "right") === "right",
      point: { x: frame.end.x, z: frame.end.z },
      cornerBase: project.placements.find((p) => isCornerOf(p, wallA.id, "base"))
        ?.id,
      cornerWall: project.placements.find((p) => isCornerOf(p, wallA.id, "wall"))
        ?.id,
    });
  }
  return result;
}

const isFloor = (p: Placement) => p.band === "base" || p.band === "tall";
const isRunItem = (p: Placement) => p.kind !== "corner";

type CornerSpec = {
  placement: Placement;
  legA: number;
  legB: number;
  style: CornerStyle;
  depth: number;
  height: number;
};

/**
 * Packs cabinets along the walls.
 * - Floor run: base and tall cabinets share one line in array order.
 * - Wall run: wall cabinets hang a clear gap above the countertop, starting
 *   clear of any tall cabinets that lead the same wall's floor run.
 * - Concave joint without a corner cabinet (blind-corner rule): a later
 *   wall's run starts clear of the previous wall's cabinets that can block
 *   it, plus clearance. Convex joints add no offset.
 * - Corner cabinets sit on concave joints; wall A's run may reach at most
 *   lengthA − legA and wall B's run starts at legB.
 * - Countertops span each contiguous group of base cabinets, with overhang;
 *   base corners contribute segments on both walls that merge with the
 *   adjacent groups.
 */
export function layoutKitchen(project: KitchenProject): KitchenLayout {
  const frames = wallFrames(project);
  const jointList = joints(project);
  const walls = project.walls;
  const placements = project.placements;
  const bandGap = project.bandGap ?? DEFAULT_BAND_GAP;
  const s = WALL_STANDOFF;

  const cabinets: PlacedCabinet[] = [];
  const counters: CounterSlab[] = [];
  const runs: WallRunInfo[] = [];

  const bounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  const expand = (x: number, z: number) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minZ = Math.min(bounds.minZ, z);
    bounds.maxZ = Math.max(bounds.maxZ, z);
  };

  const byId = new Map(placements.map((p) => [p.id, p]));
  const jointAfter = new Map<string, JointInfo>();
  const jointBefore = new Map<string, JointInfo>();
  for (const j of jointList) {
    jointAfter.set(j.wallA, j);
    jointBefore.set(j.wallB, j);
  }

  /** The valid corner cabinet of `band` on a joint (concave joints only). */
  const cornerOn = (
    joint: JointInfo | undefined,
    band: "base" | "wall",
  ): CornerSpec | null => {
    if (!joint || !joint.concave) return null;
    const id = band === "base" ? joint.cornerBase : joint.cornerWall;
    if (!id) return null;
    const placement = byId.get(id);
    if (!placement) return null;
    const raw =
      placement.corner ??
      (band === "base" ? CORNER_BASE_DEFAULTS : CORNER_WALL_DEFAULTS);
    const c = clampCorner(placement.params, raw);
    return {
      placement,
      legA: c.legA,
      legB: c.legB,
      style: c.style,
      depth: placement.params.depth,
      height: placement.params.height,
    };
  };

  const floorRunOf = (wallId: string) =>
    placements.filter((p) => p.wallId === wallId && isFloor(p) && isRunItem(p));
  const wallRunOf = (wallId: string) =>
    placements.filter(
      (p) => p.wallId === wallId && p.band === "wall" && isRunItem(p),
    );

  // wall band bottom per wall: a fixed clear gap above that wall's counter
  const bandBottomOf = new Map<string, number>();
  for (const wall of walls) {
    const tops = floorRunOf(wall.id)
      .filter((p) => p.band === "base" && p.kind !== "spacer")
      .map((p) => p.params.height);
    for (const c of [
      cornerOn(jointBefore.get(wall.id), "base"),
      cornerOn(jointAfter.get(wall.id), "base"),
    ]) {
      if (c) tops.push(c.height);
    }
    const counterTop =
      (tops.length > 0 ? Math.max(...tops) : DEFAULT_BASE_HEIGHT) +
      COUNTER_THICKNESS;
    bandBottomOf.set(wall.id, counterTop + bandGap);
  }

  const cornerClearanceFor = (blocking: Placement[]): number => {
    const depth = Math.max(0, ...blocking.map((p) => p.params.depth));
    return depth > 0 ? depth + CORNER_CLEARANCE : 0;
  };

  walls.forEach((wall, wallIndex) => {
    const frame = frames.get(wall.id)!;
    const prevWall = wallIndex > 0 ? walls[wallIndex - 1] : null;
    const nextWall = wallIndex < walls.length - 1 ? walls[wallIndex + 1] : null;
    const jBefore = jointBefore.get(wall.id);
    const jAfter = jointAfter.get(wall.id);
    const concaveBefore = !!prevWall && !!jBefore?.concave;
    const baseBefore = cornerOn(jBefore, "base");
    const wallBefore = cornerOn(jBefore, "wall");
    const baseAfter = cornerOn(jAfter, "base");
    const wallAfter = cornerOn(jAfter, "wall");

    const placeRun = (
      inRun: Placement[],
      startOffset: number,
      bandYFor: (p: Placement) => number,
    ): number => {
      let runPos = startOffset;
      for (const placement of inRun) {
        cabinets.push({
          placement,
          panels:
            placement.kind === "spacer" ? [] : solveCabinet(placement.params),
          runPos,
          bandY: bandYFor(placement),
          world: {
            x: frame.origin.x + frame.dir.x * runPos + frame.normal.x * s,
            z: frame.origin.z + frame.dir.z * runPos + frame.normal.z * s,
            rotY: frame.rotY,
          },
        });
        const { width, depth } = placement.params;
        expand(
          frame.origin.x + frame.dir.x * runPos,
          frame.origin.z + frame.dir.z * runPos,
        );
        expand(
          frame.origin.x +
            frame.dir.x * (runPos + width) +
            frame.normal.x * (depth + s),
          frame.origin.z +
            frame.dir.z * (runPos + width) +
            frame.normal.z * (depth + s),
        );
        runPos += width;
      }
      return runPos;
    };

    // floor run: base + tall in one line
    const floorRun = floorRunOf(wall.id);
    const floorStart = !concaveBefore
      ? 0
      : baseBefore
        ? baseBefore.legB
        : floorRun.length > 0
          ? cornerClearanceFor(floorRunOf(prevWall!.id))
          : 0;
    const floorLimit = baseAfter ? wall.length - baseAfter.legA : wall.length;
    const floorEnd = placeRun(floorRun, floorStart, () => 0);
    if (floorRun.length > 0) {
      runs.push({
        wallId: wall.id,
        band: "base",
        startOffset: floorStart,
        endLimit: floorLimit,
        freeSpace: floorLimit - floorEnd,
      });
    }

    // wall run: starts clear of tall cabinets leading this wall's floor run
    const wallRun = wallRunOf(wall.id);
    let leadingTall = floorStart;
    for (const placement of floorRun) {
      if (placement.band !== "tall") break;
      leadingTall += placement.params.width;
    }
    if (leadingTall > floorStart) leadingTall += CORNER_CLEARANCE;
    const wallCorner = !concaveBefore
      ? 0
      : wallBefore
        ? wallBefore.legB
        : wallRun.length > 0
          ? cornerClearanceFor(
              placements.filter(
                (p) =>
                  p.wallId === prevWall!.id &&
                  (p.band === "wall" || p.band === "tall") &&
                  isRunItem(p),
              ),
            )
          : 0;
    const wallLimit = wallAfter ? wall.length - wallAfter.legA : wall.length;
    const bandBottom = bandBottomOf.get(wall.id)!;
    const wallStart = Math.max(leadingTall, wallCorner, 0);
    const wallEnd = placeRun(wallRun, wallStart, () => bandBottom);
    if (wallRun.length > 0) {
      runs.push({
        wallId: wall.id,
        band: "wall",
        startOffset: wallStart,
        endLimit: wallLimit,
        freeSpace: wallLimit - wallEnd,
      });
    }

    // corner cabinets on the joint after this wall
    if (jAfter && nextWall) {
      const frameB = frames.get(nextWall.id)!;
      const specs: Array<[CornerSpec | null, "base" | "wall"]> = [
        [baseAfter, "base"],
        [wallAfter, "wall"],
      ];
      for (const [c, band] of specs) {
        if (!c) continue;
        const cornerParams = { legA: c.legA, legB: c.legB, style: c.style };
        const footprint = cornerFootprint(c.placement.params, cornerParams);
        const placed: PlacedCabinet = {
          placement: c.placement,
          panels: solveCorner(c.placement.params, cornerParams),
          runPos: wall.length - c.legA,
          bandY:
            band === "base"
              ? 0
              : Math.max(bandBottom, bandBottomOf.get(nextWall.id)!),
          world: { x: jAfter.point.x, z: jAfter.point.z, rotY: frameB.rotY },
          corner: {
            wallA: wall.id,
            wallB: nextWall.id,
            legA: c.legA,
            legB: c.legB,
            depth: c.depth,
            style: c.style,
            footprint,
          },
        };
        cabinets.push(placed);
        for (const [fx, fz] of footprint) {
          const pt = toRoom(placed, { x: fx, y: 0, z: fz });
          expand(pt.x, pt.z);
        }
      }
    }

    // countertops over contiguous base groups, extended by base corners
    let segment: { start: number; end: number; depth: number; top: number } | null =
      null;
    const flush = () => {
      if (!segment) return;
      const seg = segment;
      segment = null;
      if (seg.end <= seg.start) return;
      const depth = seg.depth + COUNTER_OVERHANG;
      const along = seg.end - seg.start;
      const mid = seg.start + along / 2;
      counters.push({
        wallId: wall.id,
        position: {
          x: frame.origin.x + frame.dir.x * mid + frame.normal.x * (s + depth / 2),
          y: seg.top + COUNTER_THICKNESS / 2,
          z: frame.origin.z + frame.dir.z * mid + frame.normal.z * (s + depth / 2),
        },
        size: {
          x: Math.abs(frame.dir.x) * along + Math.abs(frame.normal.x) * depth,
          y: COUNTER_THICKNESS,
          z: Math.abs(frame.dir.z) * along + Math.abs(frame.normal.z) * depth,
        },
      });
    };
    // wall B: the corner's leg B, butting against wall A's slab front edge
    if (baseBefore) {
      segment = {
        start: s + baseBefore.depth + COUNTER_OVERHANG,
        end: baseBefore.legB,
        depth: baseBefore.depth,
        top: baseBefore.height,
      };
    }
    let pos = floorStart;
    for (const placement of floorRun) {
      if (placement.band === "base" && placement.kind !== "spacer") {
        if (segment) {
          segment.end = pos + placement.params.width;
          segment.depth = Math.max(segment.depth, placement.params.depth);
          segment.top = Math.max(segment.top, placement.params.height);
        } else {
          segment = {
            start: pos,
            end: pos + placement.params.width,
            depth: placement.params.depth,
            top: placement.params.height,
          };
        }
      } else {
        flush();
      }
      pos += placement.params.width;
    }
    // wall A: the corner's leg A up to wall B's standoff line
    if (baseAfter) {
      const cStart = wall.length - baseAfter.legA;
      const cEnd = wall.length - s;
      if (segment && segment.end >= cStart - 1e-6) {
        segment.end = Math.max(segment.end, cEnd);
        segment.depth = Math.max(segment.depth, baseAfter.depth);
        segment.top = Math.max(segment.top, baseAfter.height);
      } else {
        flush();
        segment = {
          start: cStart,
          end: cEnd,
          depth: baseAfter.depth,
          top: baseAfter.height,
        };
      }
    }
    flush();
  });

  for (const wall of walls) {
    const f = frames.get(wall.id)!;
    expand(f.origin.x, f.origin.z);
    expand(f.end.x, f.end.z);
  }

  return { cabinets, counters, runs, joints: jointList, bounds };
}

/** Floor cabinets (base + tall) share one run per wall; wall units another. */
export function sameRun(a: Placement, b: Placement): boolean {
  return a.wallId === b.wallId && (a.band === "wall") === (b.band === "wall");
}

/**
 * Move placement `id` to position `index` within its run (0 = first),
 * leaving every other placement where it is. Returns the same array
 * instance when nothing changes.
 */
export function moveInRun(
  placements: Placement[],
  id: string,
  index: number,
): Placement[] {
  const target = placements.find((p) => p.id === id);
  if (!target) return placements;
  const run = placements.filter((p) => sameRun(p, target));
  const from = run.findIndex((p) => p.id === id);
  const to = Math.max(0, Math.min(run.length - 1, index));
  if (from === to) return placements;
  const reordered = [...run];
  reordered.splice(from, 1);
  reordered.splice(to, 0, target);
  let k = 0;
  return placements.map((p) => (sameRun(p, target) ? reordered[k++] : p));
}

/** Local cabinet point -> room space (plan x/z + height y). */
export function toRoom(
  cabinet: PlacedCabinet,
  local: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const cos = Math.cos(cabinet.world.rotY);
  const sin = Math.sin(cabinet.world.rotY);
  return {
    x: cabinet.world.x + local.x * cos + local.z * sin,
    y: cabinet.bandY + local.y,
    z: cabinet.world.z - local.x * sin + local.z * cos,
  };
}
