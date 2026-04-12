import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";

export const tagRouter = router({
  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db.capabilityTag.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: "asc" },
    });
  }),

  create: workspaceProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.capabilityTag.create({
        data: {
          ...input,
          workspaceId: ctx.workspaceId,
        },
      });
    }),

  update: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(50).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        description: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tag = await ctx.db.capabilityTag.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!tag) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, ...data } = input;
      return ctx.db.capabilityTag.update({ where: { id }, data });
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tag = await ctx.db.capabilityTag.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!tag) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.capabilityTag.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
