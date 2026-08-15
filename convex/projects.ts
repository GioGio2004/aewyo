import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, QueryCtx } from "./_generated/server";
import { placementValidator, wallValidator } from "./schema";

const projectData = {
  name: v.string(),
  walls: v.array(wallValidator),
  wallHeight: v.number(),
  bandGap: v.number(),
  placements: v.array(placementValidator),
};

const projectDoc = v.object({
  _id: v.id("projects"),
  _creationTime: v.number(),
  updatedAt: v.optional(v.number()),
  name: v.string(),
  walls: v.array(wallValidator),
  wallHeight: v.optional(v.number()),
  wallBandBottom: v.optional(v.number()),
  bandGap: v.optional(v.number()),
  placements: v.array(placementValidator),
});

async function ownerOf(ctx: QueryCtx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity === null ? null : identity.subject;
}

async function ownedProject(
  ctx: QueryCtx,
  owner: string,
  id: Doc<"projects">["_id"],
): Promise<Doc<"projects"> | null> {
  const doc = await ctx.db.get("projects", id);
  if (doc === null || doc.ownerExternalId !== owner) return null;
  return doc;
}

const strip = (doc: Doc<"projects">) => ({
  _id: doc._id,
  _creationTime: doc._creationTime,
  updatedAt: doc.updatedAt,
  name: doc.name,
  walls: doc.walls,
  wallHeight: doc.wallHeight,
  wallBandBottom: doc.wallBandBottom,
  bandGap: doc.bandGap,
  placements: doc.placements,
});

/** The signed-in user's projects, most recently created first. */
export const list = query({
  args: {},
  returns: v.object({
    authenticated: v.boolean(),
    projects: v.array(
      v.object({
        _id: v.id("projects"),
        _creationTime: v.number(),
        updatedAt: v.optional(v.number()),
        name: v.string(),
        cabinetCount: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const owner = await ownerOf(ctx);
    if (owner === null) return { authenticated: false, projects: [] };
    const docs = await ctx.db
      .query("projects")
      .withIndex("byOwner", (q) => q.eq("ownerExternalId", owner))
      .order("desc")
      .take(100);
    return {
      authenticated: true,
      projects: docs.map((doc) => ({
        _id: doc._id,
        _creationTime: doc._creationTime,
        updatedAt: doc.updatedAt,
        name: doc.name,
        cabinetCount: doc.placements.length,
      })),
    };
  },
});

export const get = query({
  args: { id: v.id("projects") },
  returns: v.union(projectDoc, v.null()),
  handler: async (ctx, { id }) => {
    const owner = await ownerOf(ctx);
    if (owner === null) return null;
    const doc = await ownedProject(ctx, owner, id);
    return doc === null ? null : strip(doc);
  },
});

export const create = mutation({
  args: projectData,
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const owner = await ownerOf(ctx);
    if (owner === null) throw new Error("Not authenticated");
    return await ctx.db.insert("projects", {
      ownerExternalId: owner,
      updatedAt: Date.now(),
      ...args,
    });
  },
});

export const update = mutation({
  args: { id: v.id("projects"), ...projectData },
  returns: v.null(),
  handler: async (ctx, { id, ...data }) => {
    const owner = await ownerOf(ctx);
    if (owner === null) throw new Error("Not authenticated");
    const doc = await ownedProject(ctx, owner, id);
    if (doc === null) throw new Error("Project not found");
    await ctx.db.patch("projects", id, { ...data, updatedAt: Date.now() });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const owner = await ownerOf(ctx);
    if (owner === null) throw new Error("Not authenticated");
    const doc = await ownedProject(ctx, owner, id);
    if (doc === null) return null;
    await ctx.db.delete("projects", id);
    return null;
  },
});
