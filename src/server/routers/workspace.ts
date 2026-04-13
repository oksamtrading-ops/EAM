import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";

export const workspaceRouter = router({
  /**
   * List all workspaces for the current user (active + inactive).
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { clerkId: ctx.userId },
      select: { id: true },
    });
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    return ctx.db.workspace.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  }),

  /**
   * Get or create a default workspace (backwards-compatible).
   */
  getOrCreate: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { clerkId: ctx.userId },
    });
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    let workspace = await ctx.db.workspace.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { isDefault: "desc" },
    });

    if (!workspace) {
      workspace = await ctx.db.workspace.create({
        data: {
          name: "My Workspace",
          slug: `ws-${user.id}`,
          userId: user.id,
          isDefault: true,
        },
      });
    }

    return workspace;
  }),

  /**
   * Create a new workspace.
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        clientName: z.string().max(100).optional(),
        description: z.string().max(500).optional(),
        industry: z
          .enum([
            "BANKING",
            "RETAIL",
            "LOGISTICS",
            "MANUFACTURING",
            "HEALTHCARE",
            "GENERIC",
            "ENTERPRISE_BCM",
          ])
          .optional()
          .default("GENERIC"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkId: ctx.userId },
        select: { id: true },
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Generate slug
      const baseSlug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const slug = `${baseSlug}-${Date.now().toString(36)}`;

      return ctx.db.workspace.create({
        data: {
          name: input.name,
          slug,
          clientName: input.clientName ?? null,
          description: input.description ?? null,
          industry: input.industry,
          userId: user.id,
          isDefault: false,
          isActive: true,
        },
      });
    }),

  /**
   * Update workspace details.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        clientName: z.string().optional(),
        description: z.string().optional(),
        industry: z
          .enum([
            "BANKING",
            "RETAIL",
            "LOGISTICS",
            "MANUFACTURING",
            "HEALTHCARE",
            "GENERIC",
            "ENTERPRISE_BCM",
          ])
          .optional(),
        subIndustry: z.string().max(200).nullable().optional(),
        region: z.enum(["NA", "EMEA", "APAC", "LATAM", "GLOBAL"]).nullable().optional(),
        regulatoryRegime: z.string().max(200).nullable().optional(),
        businessModelHint: z.string().max(800).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const user = await ctx.db.user.findUnique({
        where: { clerkId: ctx.userId },
        select: { id: true },
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const workspace = await ctx.db.workspace.findFirst({
        where: { id, userId: user.id },
      });
      if (!workspace) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your workspace" });
      }

      return ctx.db.workspace.update({ where: { id }, data });
    }),

  /**
   * Set a workspace as the default (unsets others).
   */
  setDefault: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkId: ctx.userId },
        select: { id: true },
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const workspace = await ctx.db.workspace.findFirst({
        where: { id: input.id, userId: user.id, isActive: true },
      });
      if (!workspace) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });
      }

      // Unset all defaults, then set this one
      await ctx.db.workspace.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });

      return ctx.db.workspace.update({
        where: { id: input.id },
        data: { isDefault: true },
      });
    }),

  /**
   * Deactivate (soft-disable) a workspace.
   */
  deactivate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkId: ctx.userId },
        select: { id: true },
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const workspace = await ctx.db.workspace.findFirst({
        where: { id: input.id, userId: user.id },
      });
      if (!workspace) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });
      }

      // Cannot deactivate the only active workspace
      const activeCount = await ctx.db.workspace.count({
        where: { userId: user.id, isActive: true },
      });
      if (activeCount <= 1 && workspace.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot deactivate your only active workspace. Create another workspace first.",
        });
      }

      const updated = await ctx.db.workspace.update({
        where: { id: input.id },
        data: { isActive: false, isDefault: false },
      });

      // If this was the default, make another one default
      if (workspace.isDefault) {
        const next = await ctx.db.workspace.findFirst({
          where: { userId: user.id, isActive: true, id: { not: input.id } },
          orderBy: { createdAt: "asc" },
        });
        if (next) {
          await ctx.db.workspace.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }

      return updated;
    }),

  /**
   * Reactivate a deactivated workspace.
   */
  reactivate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkId: ctx.userId },
        select: { id: true },
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const workspace = await ctx.db.workspace.findFirst({
        where: { id: input.id, userId: user.id },
      });
      if (!workspace) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });
      }

      return ctx.db.workspace.update({
        where: { id: input.id },
        data: { isActive: true },
      });
    }),

  /**
   * Hard-delete a workspace (GitHub-style: user must type the workspace name to confirm).
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        confirmName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkId: ctx.userId },
        select: { id: true },
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const workspace = await ctx.db.workspace.findFirst({
        where: { id: input.id, userId: user.id },
      });
      if (!workspace) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });
      }

      // GitHub-style: name must match exactly
      if (input.confirmName !== workspace.name) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Workspace name does not match. Please type the exact name to confirm deletion.",
        });
      }

      // Cannot delete the only workspace
      const totalCount = await ctx.db.workspace.count({
        where: { userId: user.id },
      });
      if (totalCount <= 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete your only workspace.",
        });
      }

      // Delete the workspace (cascading deletes handle related data)
      await ctx.db.workspace.delete({ where: { id: input.id } });

      // If this was the default, assign another
      if (workspace.isDefault) {
        const next = await ctx.db.workspace.findFirst({
          where: { userId: user.id, isActive: true },
          orderBy: { createdAt: "asc" },
        });
        if (next) {
          await ctx.db.workspace.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }

      return { deleted: true };
    }),
});
