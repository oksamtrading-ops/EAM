import { z } from "zod";
import { router, workspaceProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";

/**
 * Saved palette queries — the "star my favorite AI question" feature.
 * Scoped per workspace+user.
 */
export const paletteQueryRouter = router({
  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db.savedPaletteQuery.findMany({
      where: { workspaceId: ctx.workspaceId, userId: ctx.dbUserId },
      orderBy: [{ useCount: "desc" }, { createdAt: "desc" }],
      take: 20,
    });
  }),

  save: workspaceProcedure
    .input(
      z.object({
        label: z.string().min(1).max(120),
        queryText: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // prevent duplicates (same queryText per user)
      const existing = await ctx.db.savedPaletteQuery.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          userId: ctx.dbUserId,
          queryText: input.queryText,
        },
      });
      if (existing) return existing;
      return ctx.db.savedPaletteQuery.create({
        data: {
          workspaceId: ctx.workspaceId,
          userId: ctx.dbUserId,
          label: input.label,
          queryText: input.queryText,
        },
      });
    }),

  rename: workspaceProcedure
    .input(z.object({ id: z.string(), label: z.string().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.savedPaletteQuery.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId, userId: ctx.dbUserId },
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.savedPaletteQuery.update({
        where: { id: input.id },
        data: { label: input.label },
      });
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.savedPaletteQuery.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId, userId: ctx.dbUserId },
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.savedPaletteQuery.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  markUsed: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.savedPaletteQuery.update({
        where: { id: input.id },
        data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
      });
    }),
});
