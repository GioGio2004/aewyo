import { UserJSON } from "@clerk/backend";
import { v, Validator } from "convex/values";
import { internalMutation, query, QueryCtx } from "./_generated/server";

const userValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  name: v.string(),
  email: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  externalId: v.string(),
});

export const current = query({
  args: {},
  returns: v.union(userValidator, v.null()),
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> },
  returns: v.null(),
  async handler(ctx, { data }) {
    const primaryEmail = data.email_addresses[0]?.email_address;
    const name =
      `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() ||
      primaryEmail ||
      "Anonymous";
    const userAttributes = {
      name,
      email: primaryEmail,
      imageUrl: data.image_url ?? undefined,
      externalId: data.id,
    };

    const user = await userByExternalId(ctx, data.id);
    if (user === null) {
      await ctx.db.insert("users", userAttributes);
    } else {
      await ctx.db.patch("users", user._id, userAttributes);
    }
    return null;
  },
});

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  returns: v.null(),
  async handler(ctx, { clerkUserId }) {
    const user = await userByExternalId(ctx, clerkUserId);
    if (user !== null) {
      await ctx.db.delete("users", user._id);
    } else {
      console.warn(
        `Can't delete user, there is none for Clerk user ID: ${clerkUserId}`,
      );
    }
    return null;
  },
});

export async function getCurrentUserOrThrow(ctx: QueryCtx) {
  const userRecord = await getCurrentUser(ctx);
  if (!userRecord) throw new Error("Can't get current user");
  return userRecord;
}

export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }
  return await userByExternalId(ctx, identity.subject);
}

async function userByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("byExternalId", (q) => q.eq("externalId", externalId))
    .unique();
}
