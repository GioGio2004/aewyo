import { describe, expect, it } from "vitest";
import { layoutKitchen, toRoom } from "./layout";
import {
  CORNER_CLEARANCE,
  COUNTER_OVERHANG,
  COUNTER_THICKNESS,
  DEFAULT_BAND_GAP,
  DEFAULT_BASE_HEIGHT,
  PRESETS,
  WALL_STANDOFF,
} from "./presets";
import type { KitchenProject, Placement } from "./types";

let uid = 0;
const place = (
  wallId: string,
  band: Placement["band"],
  preset: keyof typeof PRESETS,
  label = `P${++uid}`,
): Placement => ({
  id: label,
  label,
  wallId,
  band,
  params: PRESETS[preset],
});

const project = (
  walls: Array<[string, number]>,
  placements: Placement[],
): KitchenProject => ({
  name: "test",
  walls: walls.map(([id, length]) => ({ id, length })),
  wallHeight: 2600,
  bandGap: DEFAULT_BAND_GAP,
  placements,
});

describe("layoutKitchen", () => {
  it("packs a straight base run from the wall start", () => {
    const p = project(
      [["A", 3600]],
      [
        place("A", "base", "base-doors"),
        place("A", "base", "base-drawers"),
      ],
    );
    const layout = layoutKitchen(p);
    expect(layout.cabinets.map((c) => c.runPos)).toEqual([0, 600]);
    expect(layout.runs).toHaveLength(1);
    expect(layout.runs[0].freeSpace).toBe(3600 - 1200);
  });

  it("starts the second wall's run clear of the corner", () => {
    const p = project(
      [
        ["A", 3600],
        ["B", 2400],
      ],
      [
        place("A", "base", "base-doors"),
        place("B", "base", "base-doors"),
      ],
    );
    const layout = layoutKitchen(p);
    const onB = layout.cabinets.find((c) => c.placement.wallId === "B")!;
    expect(onB.runPos).toBe(560 + CORNER_CLEARANCE);
    // wall B run heads into the room along +z, standing off its wall (-x)
    expect(onB.world.x).toBeCloseTo(3600 - WALL_STANDOFF);
    expect(onB.world.z).toBeCloseTo(560 + CORNER_CLEARANCE);
    expect(onB.world.rotY).toBeCloseTo(-Math.PI / 2);
  });

  it("does not add corner clearance on an empty previous wall", () => {
    const p = project(
      [
        ["A", 3600],
        ["B", 2400],
      ],
      [place("B", "base", "base-doors")],
    );
    expect(layoutKitchen(p).cabinets[0].runPos).toBe(0);
  });

  it("hangs the wall band a clear gap above the wall's countertop", () => {
    const p = project(
      [["A", 3600]],
      [
        place("A", "base", "base-doors"),
        place("A", "wall", "wall-unit"),
        place("A", "tall", "tall-unit"),
      ],
    );
    const layout = layoutKitchen(p);
    const wallUnit = layout.cabinets.find(
      (c) => c.placement.band === "wall",
    )!;
    const tall = layout.cabinets.find((c) => c.placement.band === "tall")!;
    // base 870 + counter 40 + gap
    expect(wallUnit.bandY).toBe(870 + COUNTER_THICKNESS + DEFAULT_BAND_GAP);
    expect(tall.bandY).toBe(0);
  });

  it("falls back to the reference counter height on a base-less wall", () => {
    const p = project(
      [["A", 3600]],
      [place("A", "wall", "wall-unit")],
    );
    const wallUnit = layoutKitchen(p).cabinets[0];
    expect(wallUnit.bandY).toBe(
      DEFAULT_BASE_HEIGHT + COUNTER_THICKNESS + DEFAULT_BAND_GAP,
    );
  });

  it("spans the countertop over the base run with overhang", () => {
    const p = project(
      [["A", 3600]],
      [
        place("A", "base", "base-doors"),
        place("A", "base", "base-doors"),
      ],
    );
    const [counter] = layoutKitchen(p).counters;
    expect(counter.size.x).toBe(1200);
    expect(counter.size.z).toBe(560 + COUNTER_OVERHANG);
    expect(counter.position.y).toBe(870 + COUNTER_THICKNESS / 2);
    expect(counter.position.x).toBe(600);
  });

  it("packs tall and base cabinets in one floor line", () => {
    const p = project(
      [["A", 3600]],
      [
        place("A", "tall", "tall-unit"),
        place("A", "base", "base-doors"),
        place("A", "wall", "wall-unit"),
      ],
    );
    const layout = layoutKitchen(p);
    const base = layout.cabinets.find((c) => c.placement.band === "base")!;
    const wallUnit = layout.cabinets.find(
      (c) => c.placement.band === "wall",
    )!;
    // base follows the tall unit on the floor
    expect(base.runPos).toBe(600);
    // wall band starts clear of the leading tall unit
    expect(wallUnit.runPos).toBe(600 + CORNER_CLEARANCE);
  });

  it("splits the countertop around an interposed tall unit", () => {
    const p = project(
      [["A", 3600]],
      [
        place("A", "base", "base-doors"),
        place("A", "tall", "tall-unit"),
        place("A", "base", "base-doors"),
      ],
    );
    const layout = layoutKitchen(p);
    expect(layout.counters).toHaveLength(2);
    expect(layout.counters[0].size.x).toBe(600);
    expect(layout.counters[1].position.x).toBe(1200 + 300);
  });

  it("reserves spacer width without producing panels, splitting the counter", () => {
    const spacer: Placement = {
      ...place("A", "base", "space", "S1"),
      kind: "spacer",
    };
    const p = project(
      [["A", 3600]],
      [place("A", "base", "base-doors"), spacer, place("A", "base", "base-doors")],
    );
    const layout = layoutKitchen(p);
    expect(layout.cabinets.map((c) => c.runPos)).toEqual([0, 600, 1200]);
    const spacerCab = layout.cabinets[1];
    expect(spacerCab.panels).toEqual([]);
    expect(layout.counters).toHaveLength(2);
    expect(layout.runs[0].freeSpace).toBe(3600 - 1800);
  });

  it("chains a third wall back along the room (U-shape)", () => {
    const p = project(
      [
        ["A", 3600],
        ["B", 2400],
        ["C", 3600],
      ],
      [place("C", "base", "base-doors")],
    );
    const layout = layoutKitchen(p);
    const cab = layout.cabinets[0];
    // wall C runs from (3600, 2400) back toward the origin along -x,
    // starting clear of wall B's cabinets... but B is empty here
    expect(cab.world.rotY).toBeCloseTo(-Math.PI);
    expect(cab.world.x).toBeCloseTo(3600);
    expect(cab.world.z).toBeCloseTo(2400 - WALL_STANDOFF);
    // its front reaches into the room (z decreases from wall C)
    const front = toRoom(cab, { x: 0, y: 0, z: 560 });
    expect(front.z).toBeCloseTo(2400 - WALL_STANDOFF - 560);
    // bounds cover the whole U
    expect(layout.bounds.maxX).toBeCloseTo(3600);
    expect(layout.bounds.maxZ).toBeCloseTo(2400);
  });

  it("maps local cabinet points into room space on a rotated wall", () => {
    const p = project(
      [
        ["A", 3600],
        ["B", 2400],
      ],
      [place("B", "base", "base-doors")],
    );
    const cab = layoutKitchen(p).cabinets[0];
    // cabinet back sits one standoff off wall B's plane (x = 3600)
    const backLeft = toRoom(cab, { x: 0, y: 0, z: 0 });
    expect(backLeft.x).toBeCloseTo(3600 - WALL_STANDOFF);
    expect(backLeft.z).toBeCloseTo(0);
    // the front face points into the room (smaller x)
    const front = toRoom(cab, { x: 0, y: 0, z: 560 });
    expect(front.x).toBeCloseTo(3600 - WALL_STANDOFF - 560);
  });
});
