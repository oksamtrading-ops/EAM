import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";

export const workspaceRouter = router({
  // Get or create default workspace for current user
  getOrCreate: protectedProcedure.query(async ({ ctx }) => {
    // Find existing workspace for this user
    let workspace = await ctx.db.workspace.findFirst({
      where: { userId: ctx.userId },
    });

    if (!workspace) {
      // Auto-create a default workspace for POC
      const user = await ctx.db.user.findUnique({
        where: { clerkId: ctx.userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in database",
        });
      }

      workspace = await ctx.db.workspace.create({
        data: {
          name: "My Workspace",
          slug: `workspace-${user.id}`,
          userId: user.id,
        },
      });
    }

    return workspace;
  }),

  // Update workspace settings
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
          ])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.workspace.update({
        where: { id },
        data,
      });
    }),
});
