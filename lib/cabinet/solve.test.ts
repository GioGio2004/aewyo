import { describe, expect, it } from "vitest";
import {
  countHardware,
  DEFAULT_PARAMS,
  LIMITS,
  maxDrawers,
  maxShelves,
  solveCabinet,
  validate,
} from "./solve";
import type { CabinetParams, Panel } from "./types";

const p = (overrides: Partial<CabinetParams> = {}): CabinetParams => ({
  ...DEFAULT_PARAMS,
  ...overrides,
});

const byRole = (panels: Panel[], role: Panel["role"]) =>
  panels.filter((panel) => panel.role === role);

describe("validate", () => {
  it("accepts the defaults", () => {
    expect(validate(p())).toEqual([]);
  });

  it("rejects out-of-range dimensions", () => {
    expect(validate(p({ width: 100 })).map((e) => e.field)).toContain("width");
    expect(validate(p({ height: 5000 })).map((e) => e.field)).toContain(
      "height",
    );
    expect(validate(p({ shelfCount: -1 })).map((e) => e.field)).toContain(
      "shelfCount",
    );
    expect(validate(p({ reveal: 20 })).map((e) => e.field)).toContain("reveal");
  });

  it("rejects fractional counts", () => {
    expect(validate(p({ shelfCount: 2.5 })).map((e) => e.field)).toContain(
      "shelfCount",
    );
    expect(validate(p({ doorCount: 1.5 })).map((e) => e.field)).toContain(
      "doorCount",
    );
  });

  it("rejects unknown decors", () => {
    expect(validate(p({ frontDecor: "gold" })).map((e) => e.field)).toContain(
      "frontDecor",
    );
  });

  it("rejects more shelves than the interior height can hold", () => {
    const params = p({ height: 600, shelfCount: 8, plinthHeight: 0 });
    const errors = validate(params);
    expect(errors.map((e) => e.field)).toContain("shelfCount");
    expect(errors[0].message.en).toContain(String(maxShelves(params)));
  });

  it("ignores shelf capacity when the front is drawers", () => {
    const params = p({
      front: "drawers",
      height: 600,
      shelfCount: 8,
      plinthHeight: 0,
      drawerCount: 3,
    });
    expect(validate(params)).toEqual([]);
  });

  it("rejects doors that end up too wide or too narrow", () => {
    expect(
      validate(p({ width: 1400, doorCount: 2 })).map((e) => e.field),
    ).toContain("doorCount");
    expect(
      validate(p({ width: 400, doorCount: 2 })).map((e) => e.field),
    ).toContain("doorCount");
  });

  it("rejects more drawers than the carcass height can hold", () => {
    const params = p({ front: "drawers", height: 400, drawerCount: 6 });
    const errors = validate(params);
    expect(errors.map((e) => e.field)).toContain("drawerCount");
    expect(errors[0].message.en).toContain(String(maxDrawers(params)));
  });
});

describe("solveCabinet (carcass)", () => {
  it("produces the expected panel set for the defaults", () => {
    const panels = solveCabinet(p());
    // 2 sides + top + bottom + 4 shelves + back + plinth + 2 doors
    expect(panels).toHaveLength(12);
    expect(byRole(panels, "shelf")).toHaveLength(4);
    expect(byRole(panels, "plinth")).toHaveLength(1);
    expect(byRole(panels, "door")).toHaveLength(2);
  });

  it("omits the plinth when plinthHeight is 0", () => {
    const panels = solveCabinet(p({ plinthHeight: 0 }));
    expect(byRole(panels, "plinth")).toHaveLength(0);
    const bottom = byRole(panels, "bottom")[0];
    expect(bottom.position.y).toBeCloseTo(DEFAULT_PARAMS.thickness / 2);
  });

  it("fits horizontal panels exactly between the sides", () => {
    const params = p();
    const inner = params.width - 2 * params.thickness;
    const panels = solveCabinet(params);
    for (const role of ["top", "bottom", "shelf", "plinth"] as const) {
      for (const panel of byRole(panels, role)) {
        expect(panel.size.x).toBe(inner);
        expect(panel.cut.length).toBe(inner);
      }
    }
  });

  it("spaces shelves evenly", () => {
    const params = p({ shelfCount: 3 });
    const shelves = byRole(solveCabinet(params), "shelf");
    const centers = shelves.map((s) => s.position.y).sort((a, b) => a - b);
    const gaps = centers.slice(1).map((y, i) => y - centers[i]);
    for (const gap of gaps) {
      expect(gap).toBeCloseTo(gaps[0], 6);
    }
    const interiorBottom = params.plinthHeight + params.thickness;
    const interiorTop = params.height - params.thickness;
    const first = centers[0] - params.thickness / 2 - interiorBottom;
    const last = interiorTop - (centers[2] + params.thickness / 2);
    expect(first).toBeCloseTo(last, 6);
  });

  it("keeps every panel inside the envelope (back and fronts excepted)", () => {
    const params = p();
    for (const panel of solveCabinet(params)) {
      const isFront = panel.role === "door" || panel.role === "drawer-front";
      const min = {
        x: panel.position.x - panel.size.x / 2,
        y: panel.position.y - panel.size.y / 2,
        z: panel.position.z - panel.size.z / 2,
      };
      const max = {
        x: panel.position.x + panel.size.x / 2,
        y: panel.position.y + panel.size.y / 2,
        z: panel.position.z + panel.size.z / 2,
      };
      expect(min.x).toBeGreaterThanOrEqual(0);
      expect(max.x).toBeLessThanOrEqual(params.width);
      expect(min.y).toBeGreaterThanOrEqual(0);
      expect(max.y).toBeLessThanOrEqual(params.height);
      expect(max.z).toBeLessThanOrEqual(
        params.depth + (isFront ? params.frontThickness : 0),
      );
      expect(min.z).toBeGreaterThanOrEqual(
        panel.role === "back" ? -params.backThickness : 0,
      );
    }
  });

  it("recesses the plinth rail for a toe kick", () => {
    const plinth = byRole(solveCabinet(p()), "plinth")[0];
    const front = plinth.position.z + plinth.size.z / 2;
    expect(front).toBeCloseTo(DEFAULT_PARAMS.depth - LIMITS.plinthRecess);
  });

  it("is deterministic", () => {
    expect(solveCabinet(p())).toEqual(solveCabinet(p()));
  });
});

describe("solveCabinet (fronts)", () => {
  it("sizes overlay doors with even reveals", () => {
    const params = p({ doorCount: 2, reveal: 3 });
    const doors = byRole(solveCabinet(params), "door");
    expect(doors).toHaveLength(2);
    const expectedWidth = (params.width - 3 * 3) / 2;
    for (const door of doors) {
      expect(door.size.x).toBeCloseTo(expectedWidth);
      expect(door.size.y).toBeCloseTo(params.height - params.plinthHeight - 6);
      expect(door.decor).toBe(params.frontDecor);
      // proud of the carcass
      expect(door.position.z - door.size.z / 2).toBeCloseTo(params.depth);
    }
    // gap between the two doors equals the reveal
    const [a, b] = doors.map((d) => d.position.x).sort((x, y) => x - y);
    const gap = b - a - expectedWidth;
    expect(gap).toBeCloseTo(3);
  });

  it("builds a box behind every drawer front", () => {
    const params = p({ front: "drawers", drawerCount: 3 });
    const panels = solveCabinet(params);
    expect(byRole(panels, "shelf")).toHaveLength(0);
    expect(byRole(panels, "drawer-front")).toHaveLength(3);
    expect(byRole(panels, "drawer-side")).toHaveLength(6);
    expect(byRole(panels, "drawer-rail")).toHaveLength(6);
    expect(byRole(panels, "drawer-bottom")).toHaveLength(3);
    // 4 carcass + back + plinth + 3×6 drawer parts
    expect(panels).toHaveLength(24);

    const fronts = byRole(panels, "drawer-front");
    const expectedHeight =
      (params.height - params.plinthHeight - 4 * params.reveal) / 3;
    for (const front of fronts) {
      expect(front.size.y).toBeCloseTo(expectedHeight);
      expect(front.size.x).toBeCloseTo(params.width - 2 * params.reveal);
    }

    const sides = byRole(panels, "drawer-side");
    const boxOuterW =
      params.width - 2 * params.thickness - 2 * LIMITS.slideClearance;
    const boxLeft = params.thickness + LIMITS.slideClearance;
    const xs = [...new Set(sides.map((s) => s.position.x))].sort(
      (a, b) => a - b,
    );
    expect(xs[0]).toBeCloseTo(boxLeft + params.thickness / 2);
    expect(xs[1]).toBeCloseTo(boxLeft + boxOuterW - params.thickness / 2);

    // boxes stay inside the carcass interior
    for (const part of [...sides, ...byRole(panels, "drawer-rail")]) {
      expect(part.position.y - part.size.y / 2).toBeGreaterThanOrEqual(
        params.plinthHeight + params.thickness,
      );
      expect(part.position.z + part.size.z / 2).toBeLessThanOrEqual(
        params.depth,
      );
    }
  });
});

describe("countHardware", () => {
  it("counts hinges from door height", () => {
    // default door height 1914 -> 4 hinges per door, 2 doors
    expect(countHardware(p())).toEqual([{ kind: "hinge", spec: "", qty: 8 }]);
    // short doors -> 2 per door
    const short = p({ height: 900, plinthHeight: 0, shelfCount: 1 });
    expect(countHardware(short)).toEqual([
      { kind: "hinge", spec: "", qty: 4 },
    ]);
  });

  it("counts slide pairs with rounded-down length", () => {
    const params = p({ front: "drawers", drawerCount: 3, depth: 520 });
    expect(countHardware(params)).toEqual([
      { kind: "slide-pair", spec: "450 mm", qty: 3 },
    ]);
  });

  it("returns nothing for open fronts", () => {
    expect(countHardware(p({ front: "none" }))).toEqual([]);
  });
});
