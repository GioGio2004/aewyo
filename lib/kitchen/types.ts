import type { CabinetParams, Panel } from "../cabinet/types";

export type Band = "base" | "wall" | "tall";

export type Wall = {
  /** "A", "B" — also the display name */
  id: string;
  /** Interior length in mm */
  length: number;
};

export type Placement = {
  /** Stable uid within the project */
  id: string;
  /** Workshop label: K1/K2 (base), W1 (wall band), T1 (tall), S1 (space) */
  label: string;
  wallId: string;
  band: Band;
  /** "spacer" reserves width in the run without producing any panels */
  kind?: "cabinet" | "spacer";
  params: CabinetParams;
};

// Walls chain left-to-right, each turning 90° into the room (1 wall =
// straight run, 2 = L, 3 = U). Room space: first wall runs along +x from
// the origin, cabinets face +z; plan coordinates are (x, z).
export type KitchenProject = {
  name: string;
  walls: Wall[];
  /** Room height — how tall the walls render and elevations measure */
  wallHeight: number;
  /** Clear gap between the countertop surface and the wall-cabinet bottoms */
  bandGap: number;
  placements: Placement[];
};

export type PlacedCabinet = {
  placement: Placement;
  panels: Panel[];
  /** Distance along the wall where this cabinet starts */
  runPos: number;
  /** Band bottom height */
  bandY: number;
  /** Cabinet-space origin in room space + rotation around Y */
  world: { x: number; z: number; rotY: number };
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
  /** Where the run starts (corner clearance) */
  startOffset: number;
  /** Unused length at the end of the wall */
  freeSpace: number;
};

export type KitchenLayout = {
  cabinets: PlacedCabinet[];
  counters: CounterSlab[];
  runs: WallRunInfo[];
  /** Plan-space bounding box over walls and cabinets */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
};
