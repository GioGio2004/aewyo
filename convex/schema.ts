import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const cabinetParamsValidator = v.object({
  width: v.number(),
  height: v.number(),
  depth: v.number(),
  thickness: v.number(),
  backThickness: v.number(),
  shelfCount: v.number(),
  plinthHeight: v.number(),
  shelfSetback: v.number(),
  front: v.union(v.literal("none"), v.literal("doors"), v.literal("drawers")),
  doorCount: v.number(),
  drawerCount: v.number(),
  reveal: v.number(),
  frontThickness: v.number(),
  carcassDecor: v.string(),
  frontDecor: v.string(),
  appliance: v.optional(
    v.union(
      v.literal("sink"),
      v.literal("oven"),
      v.literal("hob"),
      v.literal("fridge"),
      v.literal("hood"),
    ),
  ),
});

export const wallValidator = v.object({
  id: v.string(),
  length: v.number(),
  // turn toward the next wall; missing = "right" (legacy)
  turn: v.optional(v.union(v.literal("left"), v.literal("right"))),
});

export const cornerParamsValidator = v.object({
  legA: v.number(),
  legB: v.number(),
  style: v.union(v.literal("diagonal"), v.literal("blind")),
});

export const placementValidator = v.object({
  id: v.string(),
  label: v.string(),
  wallId: v.string(),
  band: v.union(v.literal("base"), v.literal("wall"), v.literal("tall")),
  kind: v.optional(
    v.union(v.literal("cabinet"), v.literal("spacer"), v.literal("corner")),
  ),
  params: cabinetParamsValidator,
  // present for kind "corner"
  corner: v.optional(cornerParamsValidator),
});

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    // Clerk user ID (identity.subject)
    externalId: v.string(),
  }).index("byExternalId", ["externalId"]),

  projects: defineTable({
    // Clerk user ID (identity.subject) — independent of the users sync
    ownerExternalId: v.string(),
    name: v.string(),
    // last explicit save (ms since epoch); optional for legacy docs
    updatedAt: v.optional(v.number()),
    walls: v.array(wallValidator),
    // optional for docs saved before these settings existed
    wallHeight: v.optional(v.number()),
    // legacy floor-measured band height, superseded by bandGap
    wallBandBottom: v.optional(v.number()),
    bandGap: v.optional(v.number()),
    placements: v.array(placementValidator),
  }).index("byOwner", ["ownerExternalId"]),
});
