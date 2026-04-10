import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";

export const workspaceRouter = router({
  getOrCreate: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { clerkId: ctx.userId },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    let workspace = await ctx.db.workspace.findFirst({
      where: { userId: user.id },
    });

    if (!workspace) {
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

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        clientName: z.string().optional(),
        description: z.string().optional(),
        industry: z
          .enum(["BANKING", "RETAIL", "LOGISTICS", "MANUFACTURING", "HEALTHCARE", "GENERIC"])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Verify ownership
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
});
