import type { CabinetParams, Panel } from "../cabinet/types";

export type Band = "base" | "wall" | "tall";

/**
 * Direction of the turn from a wall to the NEXT wall, seen from a walker
 * moving along the wall with the room on their right:
 * - "right": turns into the room → concave / inside corner (cabinets meet)
 * - "left":  turns away from the room → convex / outside corner
 * A niche = left, right, right, left. Default (legacy projects) is "right".
 * Ignored on the last wall.
 */
export type Turn = "left" | "right";

export type Wall = {
  /** "A", "B", "C"… — also the display name */
  id: string;
  /** Interior length in mm */
  length: number;
  /** Turn toward the next wall (see Turn). Defaults to "right". */
  turn?: Turn;
};

export type CornerStyle = "diagonal" | "blind";

/**
 * Corner cabinet footprint. Legs are measured from the corner point (the
 * meeting line of the two wall faces) and INCLUDE the wall standoff.
 * - legA: along the wall BEFORE the joint (placement.wallId), measured back
 *   from its end
 * - legB: along the wall AFTER the joint, measured from its start
 * The neighbouring runs pack against the legs: wall A's run may extend at
 * most to (lengthA − legA); wall B's run starts at legB.
 */
export type CornerParams = {
  legA: number;
  legB: number;
  style: CornerStyle;
};

export type Placement = {
  /** Stable uid within the project */
  id: string;
  /** Workshop label: K1/K2 (base), W1 (wall band), T1 (tall), S1 (space), C1 (corner) */
  label: string;
  /** Wall the item belongs to. For corners: the wall BEFORE the joint. */
  wallId: string;
  band: Band;
  /**
   * "spacer" reserves width in the run without producing any panels;
   * "corner" sits on the joint after `wallId` (must be a concave joint,
   * band base or wall) and is described by `corner`.
   */
  kind?: "cabinet" | "spacer" | "corner";
  params: CabinetParams;
  corner?: CornerParams;
};

// Room space: the first wall runs along +x from the origin, its room side
// is +z; each later wall starts where the previous one ends, rotated by
// its predecessor's turn. Plan coordinates are (x, z), heights are y.
export type KitchenProject = {
  name: string;
  walls: Wall[];
  /** Room height — how tall the walls render and elevations measure */
  wallHeight: number;
  /** Clear gap between the countertop surface and the wall-cabinet bottoms */
  bandGap: number;
  placements: Placement[];
};

/** Per-wall coordinate frame in room space. */
export type WallFrame = {
  id: string;
  index: number;
  /** Wall start (corner with the previous wall, or the room origin) */
  origin: { x: number; z: number };
  /** Wall end (corner with the next wall) */
  end: { x: number; z: number };
  /** Unit vector along the wall */
  dir: { x: number; z: number };
  /** Unit vector from the wall face into the room */
  normal: { x: number; z: number };
  /** three.js Y rotation mapping local +x → dir, local +z → normal */
  rotY: number;
  /** Turn to the next wall (undefined on the last wall) */
  turn?: Turn;
};

/** A joint between wall[i] and wall[i+1]. */
export type JointInfo = {
  /** index of the wall BEFORE the joint */
  index: number;
  wallA: string;
  wallB: string;
  /** true for a right turn: an inside corner where cabinets can meet */
  concave: boolean;
  /** corner point in room space */
  point: { x: number; z: number };
  /** ids of corner placements occupying this joint, per band */
  cornerBase?: string;
  cornerWall?: string;
};

export type PlacedCabinet = {
  placement: Placement;
  /**
   * Solved panels in cabinet-local space (origin left-bottom-back for
   * regular cabinets; for corners see `corner`). Spacers have none.
   */
  panels: Panel[];
  /** Distance along the wall where this item starts (corners: lengthA − legA) */
  runPos: number;
  /** Band bottom height */
  bandY: number;
  /**
   * Cabinet-space origin in room space + rotation around Y. Regular
   * cabinets already include the wall standoff; corner cabinets sit
   * exactly on the corner point in the NEXT wall's frame (local x along
   * wall B, local z back along wall A) and their panels include the
   * standoffs themselves.
   */
  world: { x: number; z: number; rotY: number };
  /** Present for kind "corner" */
  corner?: {
    wallA: string;
    wallB: string;
    legA: number;
    legB: number;
    depth: number;
    style: CornerStyle;
    /** Plan footprint polygon in the corner-local frame (x, z), mm */
    footprint: Array<[number, number]>;
  };
};

export type CounterSlab = {
  wallId: string;
  /** Box centre and size in room space */
  position: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
};

export type WallRunInfo = {
  wallId: string;
  band: Band;
  /** Where the run starts (corner clearance / corner leg) */
  startOffset: number;
  /** Where the run may end at most (wall length minus a corner leg) */
  endLimit: number;
  /** Unused length between the run end and endLimit (negative = overflow) */
  freeSpace: number;
};

export type KitchenLayout = {
  cabinets: PlacedCabinet[];
  counters: CounterSlab[];
  runs: WallRunInfo[];
  joints: JointInfo[];
  /** Plan-space bounding box over walls and cabinets */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
};
