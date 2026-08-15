import { describe, expect, it } from "vitest";
import { joints, layoutKitchen, moveInRun, toRoom, wallFrames } from "./layout";
import {
  CORNER_CLEARANCE,
  CORNER_PARAMS,
  COUNTER_OVERHANG,
  COUNTER_THICKNESS,
  DEFAULT_BAND_GAP,
  DEFAULT_BASE_HEIGHT,
  PRESETS,
  WALL_STANDOFF,
} from "./presets";
import type {
  CornerParams,
  CounterSlab,
  KitchenProject,
  Placement,
  Turn,
} from "./types";

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

const corner = (
  wallId: string,
  band: "base" | "wall",
  params: Partial<CornerParams> = {},
  label = `C${++uid}`,
): Placement => ({
  id: label,
  label,
  wallId,
  band,
  kind: "corner",
  params: CORNER_PARAMS[band],
  corner: { legA: 900, legB: 900, style: "diagonal", ...params },
});

const project = (
  walls: Array<[string, number] | [string, number, Turn]>,
  placements: Placement[],
): KitchenProject => ({
  name: "test",
  walls: walls.map(([id, length, turn]) =>
    turn ? { id, length, turn } : { id, length },
  ),
  wallHeight: 2600,
  bandGap: DEFAULT_BAND_GAP,
  placements,
});

/** Plan rectangle of a counter slab */
const rect = (c: CounterSlab) => ({
  x0: c.position.x - c.size.x / 2,
  x1: c.position.x + c.size.x / 2,
  z0: c.position.z - c.size.z / 2,
  z1: c.position.z + c.size.z / 2,
});
const covers = (c: CounterSlab, x: number, z: number) => {
  const r = rect(c);
  return x >= r.x0 - 1e-6 && x <= r.x1 + 1e-6 && z >= r.z0 - 1e-6 && z <= r.z1 + 1e-6;
};
const overlapArea = (a: CounterSlab, b: CounterSlab) => {
  const ra = rect(a);
  const rb = rect(b);
  const dx = Math.min(ra.x1, rb.x1) - Math.max(ra.x0, rb.x0);
  const dz = Math.min(ra.z1, rb.z1) - Math.max(ra.z0, rb.z0);
  return dx > 0 && dz > 0 ? dx * dz : 0;
};

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

  it("moves a cabinet within its run without disturbing other runs", () => {
    const k1 = place("A", "base", "base-doors", "K1");
    const w1 = place("A", "wall", "wall-unit", "W1");
    const k2 = place("A", "base", "base-doors", "K2");
    const t1 = place("A", "tall", "tall-unit", "T1");
    const k3 = place("B", "base", "base-doors", "K3");
    const list = [k1, w1, k2, t1, k3];
    // floor run on A is [K1, K2, T1]; move T1 to the front
    const moved = moveInRun(list, "T1", 0);
    expect(moved.map((p) => p.id)).toEqual(["T1", "W1", "K1", "K2", "K3"]);
    // W1 (wall run) and K3 (wall B) untouched; no-op returns same array
    expect(moveInRun(list, "K1", 0)).toBe(list);
    expect(moveInRun(list, "K2", 99).map((p) => p.id)).toEqual([
      "K1",
      "W1",
      "T1",
      "K2",
      "K3",
    ]);
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

  it("reports runs with an endLimit equal to the wall length when no corner", () => {
    const p = project([["A", 3600]], [place("A", "base", "base-doors")]);
    const [run] = layoutKitchen(p).runs;
    expect(run.endLimit).toBe(3600);
    expect(run.freeSpace).toBe(3000);
    expect(layoutKitchen(p).joints).toEqual([]);
  });
});

describe("wallFrames / joints with turns", () => {
  it("chains a niche (left, right, right, left) back onto the room line", () => {
    const p = project(
      [
        ["A", 3600, "left"],
        ["N1", 600, "right"],
        ["N2", 1200, "right"],
        ["N3", 600, "left"],
        ["B", 2400],
      ],
      [place("N2", "base", "base-doors")],
    );
    const f = wallFrames(p);
    const A = f.get("A")!;
    const N1 = f.get("N1")!;
    const N2 = f.get("N2")!;
    const N3 = f.get("N3")!;
    const B = f.get("B")!;
    // A along +x, room on +z
    expect(A.origin).toEqual({ x: 0, z: 0 });
    expect(A.dir).toEqual({ x: 1, z: 0 });
    expect(A.normal).toEqual({ x: 0, z: 1 });
    expect(A.end).toEqual({ x: 3600, z: 0 });
    expect(A.turn).toBe("left");
    // N1 turns left → away from the room, along -z
    expect(N1.origin).toEqual({ x: 3600, z: 0 });
    expect(N1.dir).toEqual({ x: 0, z: -1 });
    expect(N1.normal).toEqual({ x: 1, z: 0 });
    expect(N1.end).toEqual({ x: 3600, z: -600 });
    expect(N1.rotY).toBeCloseTo(Math.PI / 2);
    // N2 turns right → back along +x, recessed by 600, facing the room
    expect(N2.origin).toEqual({ x: 3600, z: -600 });
    expect(N2.dir).toEqual({ x: 1, z: 0 });
    expect(N2.normal).toEqual({ x: 0, z: 1 });
    expect(N2.end).toEqual({ x: 4800, z: -600 });
    expect(N2.rotY).toBeCloseTo(0);
    // N3 turns right → along +z back to the room line
    expect(N3.origin).toEqual({ x: 4800, z: -600 });
    expect(N3.dir).toEqual({ x: 0, z: 1 });
    expect(N3.normal).toEqual({ x: -1, z: 0 });
    expect(N3.end).toEqual({ x: 4800, z: 0 });
    expect(N3.rotY).toBeCloseTo(-Math.PI / 2);
    // B continues along +x on the room line
    expect(B.origin).toEqual({ x: 4800, z: 0 });
    expect(B.dir).toEqual({ x: 1, z: 0 });
    expect(B.end).toEqual({ x: 7200, z: 0 });
    expect(B.index).toBe(4);
    expect(B.turn).toBeUndefined();

    // joints: convex, concave, concave, convex
    const js = joints(p);
    expect(js.map((j) => [j.wallA, j.wallB, j.concave])).toEqual([
      ["A", "N1", false],
      ["N1", "N2", true],
      ["N2", "N3", true],
      ["N3", "B", false],
    ]);
    expect(js.map((j) => j.point)).toEqual([
      { x: 3600, z: 0 },
      { x: 3600, z: -600 },
      { x: 4800, z: -600 },
      { x: 4800, z: 0 },
    ]);

    // a cabinet on N2 stands in the niche and faces +z (into the room)
    const layout = layoutKitchen(p);
    const cab = layout.cabinets[0];
    expect(cab.runPos).toBe(0);
    expect(cab.world.x).toBeCloseTo(3600);
    expect(cab.world.z).toBeCloseTo(-600 + WALL_STANDOFF);
    const front = toRoom(cab, { x: 300, y: 0, z: 560 });
    expect(front.x).toBeCloseTo(3900);
    expect(front.z).toBeCloseTo(-600 + WALL_STANDOFF + 560);
    expect(layout.joints).toEqual(js);
    // bounds include the recess
    expect(layout.bounds.minZ).toBeCloseTo(-600);
    expect(layout.bounds.maxX).toBeCloseTo(7200);
  });

  it("keeps legacy projects (no turn) turning right", () => {
    const p = project(
      [
        ["A", 3600],
        ["B", 2400],
        ["C", 3600],
      ],
      [],
    );
    const f = wallFrames(p);
    expect(f.get("A")!.turn).toBe("right");
    expect(f.get("B")!.dir).toEqual({ x: 0, z: 1 });
    expect(f.get("C")!.dir).toEqual({ x: -1, z: 0 });
    expect(f.get("C")!.origin).toEqual({ x: 3600, z: 2400 });
    expect(joints(p).every((j) => j.concave)).toBe(true);
  });

  it("gives a convex joint no start offset", () => {
    const p = project(
      [
        ["A", 3600, "left"],
        ["N1", 600],
      ],
      [
        place("A", "base", "base-doors"),
        place("A", "wall", "wall-unit"),
        place("N1", "base", "base-doors"),
        place("N1", "wall", "wall-unit"),
      ],
    );
    const layout = layoutKitchen(p);
    const onN1 = layout.cabinets.filter((c) => c.placement.wallId === "N1");
    expect(onN1.map((c) => c.runPos)).toEqual([0, 0]);
    expect(
      layout.runs.filter((r) => r.wallId === "N1").map((r) => r.startOffset),
    ).toEqual([0, 0]);
    // the same chain turning right keeps the blind-corner clearance
    const concave = layoutKitchen(
      project(
        [
          ["A", 3600, "right"],
          ["N1", 600],
        ],
        [place("A", "base", "base-doors"), place("N1", "base", "base-doors")],
      ),
    );
    expect(concave.cabinets[1].runPos).toBe(560 + CORNER_CLEARANCE);
  });
});

describe("corner cabinets", () => {
  it("packs the runs around a base corner and covers it with counters", () => {
    const p = project(
      [
        ["A", 3600],
        ["B", 2400],
      ],
      [
        place("A", "base", "base-doors", "K1"),
        corner("A", "base", { legA: 900, legB: 900 }, "C1"),
        place("B", "base", "base-doors", "K2"),
      ],
    );
    const layout = layoutKitchen(p);
    const runA = layout.runs.find((r) => r.wallId === "A" && r.band === "base")!;
    const runB = layout.runs.find((r) => r.wallId === "B" && r.band === "base")!;
    expect(runA.startOffset).toBe(0);
    expect(runA.endLimit).toBe(3600 - 900);
    expect(runA.freeSpace).toBe(2700 - 600);
    expect(runB.startOffset).toBe(900);
    expect(runB.endLimit).toBe(2400);
    expect(runB.freeSpace).toBe(2400 - 1500);

    const k2 = layout.cabinets.find((c) => c.placement.id === "K2")!;
    expect(k2.runPos).toBe(900);

    const c1 = layout.cabinets.find((c) => c.placement.id === "C1")!;
    expect(c1.runPos).toBe(2700);
    expect(c1.bandY).toBe(0);
    expect(c1.world.x).toBeCloseTo(3600);
    expect(c1.world.z).toBeCloseTo(0);
    expect(c1.world.rotY).toBeCloseTo(-Math.PI / 2);
    expect(c1.corner).toMatchObject({
      wallA: "A",
      wallB: "B",
      legA: 900,
      legB: 900,
      depth: 560,
      style: "diagonal",
    });
    expect(c1.corner!.footprint).toHaveLength(5);
    expect(c1.panels.length).toBeGreaterThan(0);
    // corner-local x runs along wall B (+z), local z back along wall A (-x)
    expect(toRoom(c1, { x: 100, y: 0, z: 0 })).toMatchObject({ x: 3600, z: 100 });
    expect(toRoom(c1, { x: 0, y: 0, z: 100 })).toMatchObject({ x: 3500, z: 0 });
    expect(layout.joints[0]).toMatchObject({ concave: true, cornerBase: "C1" });

    // counters: K1 alone, the corner's leg on A, the corner's leg on B + K2
    const { counters } = layout;
    expect(counters).toHaveLength(3);
    for (let i = 0; i < counters.length; i++) {
      for (let j = i + 1; j < counters.length; j++) {
        expect(overlapArea(counters[i], counters[j])).toBeLessThan(1e-6);
      }
    }
    // the corner square and both legs are under a slab
    const probes: Array<[number, number]> = [
      [300, 300],
      [300, 700],
      [700, 300],
      [880, 300],
      [300, 880],
    ];
    for (const [lx, lz] of probes) {
      const r = toRoom(c1, { x: lx, y: 0, z: lz });
      expect(counters.some((c) => covers(c, r.x, r.z))).toBe(true);
    }
    // wall B's slab runs from the corner leg through K2 in one piece
    const onB = counters.filter((c) => c.wallId === "B");
    expect(onB).toHaveLength(1);
    const rb = rect(onB[0]);
    expect(rb.z0).toBeCloseTo(WALL_STANDOFF + 560 + COUNTER_OVERHANG);
    expect(rb.z1).toBeCloseTo(1500);
    expect(rb.x1).toBeCloseTo(3600 - WALL_STANDOFF);
    // wall A's corner slab reaches wall B's standoff line
    const onA = counters.filter((c) => c.wallId === "A");
    expect(onA).toHaveLength(2);
    expect(rect(onA[1]).x0).toBeCloseTo(2700);
    expect(rect(onA[1]).x1).toBeCloseTo(3600 - WALL_STANDOFF);
    // bounds cover the corner footprint
    expect(layout.bounds.maxX).toBeCloseTo(3600);
    expect(layout.bounds.maxZ).toBeCloseTo(2400);
  });

  it("merges the corner segment with a base run ending at the leg", () => {
    const p = project(
      [
        ["A", 3600],
        ["B", 2400],
      ],
      [
        place("A", "base", "base-doors"),
        place("A", "base", "base-doors"),
        place("A", "base", "base-doors"),
        place("A", "base", "base-doors"),
        corner("A", "base", { legA: 1200, legB: 900 }),
      ],
    );
    const layout = layoutKitchen(p);
    const onA = layout.counters.filter((c) => c.wallId === "A");
    expect(onA).toHaveLength(1);
    expect(rect(onA[0]).x0).toBeCloseTo(0);
    expect(rect(onA[0]).x1).toBeCloseTo(3600 - WALL_STANDOFF);
    // wall B: only the corner's leg segment
    const onB = layout.counters.filter((c) => c.wallId === "B");
    expect(onB).toHaveLength(1);
    expect(rect(onB[0]).z1).toBeCloseTo(900);
    expect(layout.runs[0].freeSpace).toBe(0);
  });

  it("ignores corners on convex joints and on the last wall", () => {
    const p = project(
      [
        ["A", 3600, "left"],
        ["B", 2400],
      ],
      [corner("A", "base"), corner("B", "base"), place("B", "base", "base-doors")],
    );
    const layout = layoutKitchen(p);
    expect(layout.cabinets).toHaveLength(1);
    expect(layout.cabinets[0].runPos).toBe(0);
    expect(layout.joints[0].cornerBase).toBeDefined();
    expect(layout.joints[0].concave).toBe(false);
  });

  it("clamps too-short legs to the buildable minimum", () => {
    const p = project(
      [
        ["A", 3600],
        ["B", 2400],
      ],
      [corner("A", "base", { legA: 100, legB: 100 }), place("B", "base", "base-doors")],
    );
    const layout = layoutKitchen(p);
    const c = layout.cabinets.find((x) => x.corner)!;
    expect(c.corner!.legA).toBe(WALL_STANDOFF + 560 + 100);
    expect(c.runPos).toBe(3600 - (WALL_STANDOFF + 560 + 100));
    const onB = layout.cabinets.find((x) => x.placement.wallId === "B")!;
    expect(onB.runPos).toBe(WALL_STANDOFF + 560 + 100);
  });

  it("hangs a wall-band corner at the band bottom and limits both wall runs", () => {
    const p = project(
      [
        ["A", 3600],
        ["B", 2400],
      ],
      [
        place("A", "base", "base-doors"),
        place("A", "wall", "wall-unit", "W1"),
        corner("A", "wall", { legA: 600, legB: 600 }, "CW"),
        place("B", "wall", "wall-unit", "W2"),
        place("B", "base", "base-doors"),
      ],
    );
    const layout = layoutKitchen(p);
    const bandBottom = 870 + COUNTER_THICKNESS + DEFAULT_BAND_GAP;
    const cw = layout.cabinets.find((c) => c.placement.id === "CW")!;
    expect(cw.bandY).toBe(bandBottom);
    expect(cw.runPos).toBe(3000);
    expect(cw.world.rotY).toBeCloseTo(-Math.PI / 2);
    // top of the corner sits at the band bottom + its height
    expect(toRoom(cw, { x: 0, y: 720, z: 0 }).y).toBe(bandBottom + 720);
    const w1 = layout.cabinets.find((c) => c.placement.id === "W1")!;
    const w2 = layout.cabinets.find((c) => c.placement.id === "W2")!;
    expect(w1.bandY).toBe(bandBottom);
    expect(w2.runPos).toBe(600);
    const wallRuns = layout.runs.filter((r) => r.band === "wall");
    expect(wallRuns.map((r) => [r.wallId, r.startOffset, r.endLimit])).toEqual([
      ["A", 0, 3000],
      ["B", 600, 2400],
    ]);
    // the base runs are not affected by a wall-band corner
    const baseB = layout.runs.find((r) => r.wallId === "B" && r.band === "base")!;
    expect(baseB.startOffset).toBe(560 + CORNER_CLEARANCE);
    expect(layout.joints[0].cornerWall).toBe("CW");
    expect(layout.joints[0].cornerBase).toBeUndefined();
  });

  it("uses the taller of the two walls' band bottoms for a wall corner", () => {
    const tallBase: Placement = {
      ...place("B", "base", "base-doors"),
      params: { ...PRESETS["base-doors"], height: 920 },
    };
    const p = project(
      [
        ["A", 3600],
        ["B", 2400],
      ],
      [place("A", "base", "base-doors"), corner("A", "wall", { legA: 600, legB: 600 }), tallBase],
    );
    const cw = layoutKitchen(p).cabinets.find((c) => c.corner)!;
    expect(cw.bandY).toBe(920 + COUNTER_THICKNESS + DEFAULT_BAND_GAP);
  });
});
