import { solveCabinet } from "../cabinet/solve";
import {
  CORNER_CLEARANCE,
  COUNTER_OVERHANG,
  COUNTER_THICKNESS,
  DEFAULT_BAND_GAP,
  DEFAULT_BASE_HEIGHT,
  WALL_STANDOFF,
} from "./presets";
import type {
  CounterSlab,
  KitchenLayout,
  KitchenProject,
  PlacedCabinet,
  Placement,
  WallRunInfo,
} from "./types";

// Walls chain left-to-right, each turning 90° into the room.
// dir = along the wall, normal = into the room, rotY = three.js Y rotation.
export type WallFrame = {
  origin: { x: number; z: number };
  dir: { x: number; z: number };
  normal: { x: number; z: number };
  rotY: number;
};

const DIRS = [
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
  { x: 0, z: -1 },
];

export function wallFrames(project: KitchenProject): Map<string, WallFrame> {
  const frames = new Map<string, WallFrame>();
  let origin = { x: 0, z: 0 };
  project.walls.forEach((wall, i) => {
    const dir = DIRS[i % 4];
    const normal = DIRS[(i + 1) % 4];
    frames.set(wall.id, { origin, dir, normal, rotY: -i * (Math.PI / 2) });
    origin = {
      x: origin.x + dir.x * wall.length,
      z: origin.z + dir.z * wall.length,
    };
  });
  return frames;
}

const isFloor = (p: Placement) => p.band === "base" || p.band === "tall";

/**
 * Packs cabinets along the walls.
 * - Floor run: base and tall cabinets share one line in array order.
 * - Wall run: wall cabinets hang at WALL_BAND_BOTTOM, starting clear of
 *   any tall cabinets that lead the same wall's floor run.
 * - Inside corner (blind-corner rule): a later wall's run starts clear of
 *   the previous wall's cabinets that can block it, plus clearance.
 * - Countertops span each contiguous group of base cabinets, with overhang.
 */
export function layoutKitchen(project: KitchenProject): KitchenLayout {
  const frames = wallFrames(project);
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

  project.walls.forEach((wall, wallIndex) => {
    const frame = frames.get(wall.id)!;
    const prevWall = wallIndex > 0 ? project.walls[wallIndex - 1] : null;

    const cornerClearanceFor = (blocking: Placement[]): number => {
      const depth = Math.max(0, ...blocking.map((p) => p.params.depth));
      return depth > 0 ? depth + CORNER_CLEARANCE : 0;
    };

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
            x:
              frame.origin.x +
              frame.dir.x * runPos +
              frame.normal.x * WALL_STANDOFF,
            z:
              frame.origin.z +
              frame.dir.z * runPos +
              frame.normal.z * WALL_STANDOFF,
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
            frame.normal.x * (depth + WALL_STANDOFF),
          frame.origin.z +
            frame.dir.z * (runPos + width) +
            frame.normal.z * (depth + WALL_STANDOFF),
        );
        runPos += width;
      }
      return runPos;
    };

    // floor run: base + tall in one line
    const floorRun = project.placements.filter(
      (p) => p.wallId === wall.id && isFloor(p),
    );
    const floorStart = prevWall
      ? floorRun.length > 0
        ? cornerClearanceFor(
            project.placements.filter(
              (p) => p.wallId === prevWall.id && isFloor(p),
            ),
          )
        : 0
      : 0;
    const floorEnd = placeRun(floorRun, floorStart, () => 0);
    if (floorRun.length > 0) {
      runs.push({
        wallId: wall.id,
        band: "base",
        startOffset: floorStart,
        freeSpace: wall.length - floorEnd,
      });
    }

    // wall run: starts clear of tall cabinets leading this wall's floor run
    const wallRun = project.placements.filter(
      (p) => p.wallId === wall.id && p.band === "wall",
    );
    let leadingTall = floorStart;
    for (const placement of floorRun) {
      if (placement.band !== "tall") break;
      leadingTall += placement.params.width;
    }
    if (leadingTall > floorStart) leadingTall += CORNER_CLEARANCE;
    const wallCorner =
      prevWall && wallRun.length > 0
        ? cornerClearanceFor(
            project.placements.filter(
              (p) =>
                p.wallId === prevWall.id &&
                (p.band === "wall" || p.band === "tall"),
            ),
          )
        : 0;
    // hang the wall band a fixed clear gap above this wall's countertop
    const baseTops = floorRun
      .filter((p) => p.band === "base" && p.kind !== "spacer")
      .map((p) => p.params.height);
    const counterTop =
      (baseTops.length > 0 ? Math.max(...baseTops) : DEFAULT_BASE_HEIGHT) +
      COUNTER_THICKNESS;
    const bandBottom =
      counterTop + (project.bandGap ?? DEFAULT_BAND_GAP);

    const wallStart = Math.max(leadingTall, wallCorner);
    const wallEnd = placeRun(wallRun, wallStart, () => bandBottom);
    if (wallRun.length > 0) {
      runs.push({
        wallId: wall.id,
        band: "wall",
        startOffset: wallStart,
        freeSpace: wall.length - wallEnd,
      });
    }

    // countertops over contiguous base groups in the floor run
    let segment: { start: number; end: number; depth: number; top: number } | null =
      null;
    const flush = () => {
      if (!segment) return;
      const depth = segment.depth + COUNTER_OVERHANG;
      const along = segment.end - segment.start;
      const mid = segment.start + along / 2;
      counters.push({
        wallId: wall.id,
        position: {
          x:
            frame.origin.x +
            frame.dir.x * mid +
            frame.normal.x * (WALL_STANDOFF + depth / 2),
          y: segment.top + COUNTER_THICKNESS / 2,
          z:
            frame.origin.z +
            frame.dir.z * mid +
            frame.normal.z * (WALL_STANDOFF + depth / 2),
        },
        size: {
          x: Math.abs(frame.dir.x) * along + Math.abs(frame.normal.x) * depth,
          y: COUNTER_THICKNESS,
          z: Math.abs(frame.dir.z) * along + Math.abs(frame.normal.z) * depth,
        },
      });
      segment = null;
    };
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
    flush();
  });

  for (const wall of project.walls) {
    const f = frames.get(wall.id)!;
    expand(f.origin.x, f.origin.z);
    expand(
      f.origin.x + f.dir.x * wall.length,
      f.origin.z + f.dir.z * wall.length,
    );
  }

  return { cabinets, counters, runs, bounds };
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
