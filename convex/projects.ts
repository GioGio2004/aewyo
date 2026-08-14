import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { placementValidator, wallValidator } from "./schema";

const projectShape = v.object({
  name: v.string(),
  walls: v.array(wallValidator),
  wallHeight: v.optional(v.number()),
  wallBandBottom: v.optional(v.number()),
  bandGap: v.optional(v.number()),
  placements: v.array(placementValidator),
});

// One kitchen project per user for now.
export const getMine = query({
  args: {},
  returns: v.object({
    authenticated: v.boolean(),
    project: v.union(projectShape, v.null()),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return { authenticated: false, project: null };
    }
    const doc = await ctx.db
      .query("projects")
      .withIndex("byOwner", (q) => q.eq("ownerExternalId", identity.subject))
      .unique();
    if (doc === null) {
      return { authenticated: true, project: null };
    }
    return {
      authenticated: true,
      project: {
        name: doc.name,
        walls: doc.walls,
        wallHeight: doc.wallHeight,
        wallBandBottom: doc.wallBandBottom,
        bandGap: doc.bandGap,
        placements: doc.placements,
      },
    };
  },
});

export const save = mutation({
  args: {
    name: v.string(),
    walls: v.array(wallValidator),
    wallHeight: v.number(),
    bandGap: v.number(),
    placements: v.array(placementValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const existing = await ctx.db
      .query("projects")
      .withIndex("byOwner", (q) => q.eq("ownerExternalId", identity.subject))
      .unique();
    if (existing === null) {
      await ctx.db.insert("projects", {
        ownerExternalId: identity.subject,
        ...args,
      });
    } else {
      await ctx.db.patch("projects", existing._id, args);
    }
    return null;
  },
});
