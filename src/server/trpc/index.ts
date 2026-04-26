import "@/server/env"; // boot-time env validation (throws on missing required keys in prod)
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

// Auth middleware — requires Clerk userId
const enforceAuth = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

export const protectedProcedure = t.procedure.use(enforceAuth);

// Workspace middleware — ensures workspace context AND ownership
const enforceWorkspace = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!ctx.workspaceId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Workspace context required",
    });
  }

  // Verify the authenticated user owns this workspace
  const user = await ctx.db.user.findUnique({
    where: { clerkId: ctx.userId },
    select: { id: true },
  });
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
  }

  const workspace = await ctx.db.workspace.findFirst({
    where: { id: ctx.workspaceId, userId: user.id },
  });
  if (!workspace) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Not authorized for this workspace",
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      dbUserId: user.id,
      workspaceId: ctx.workspaceId,
    },
  });
});

export const workspaceProcedure = t.procedure
  .use(enforceAuth)
  .use(enforceWorkspace);
