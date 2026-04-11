import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";

export const objectiveRouter = router({
  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db.objective.findMany({
      where: { workspaceId: ctx.workspaceId, isActive: true },
      include: {
        initiatives: {
          include: {
            initiative: {
              select: {
                id: true,
                name: true,
                status: true,
                progressPct: true,
              },
            },
          },
        },
      },
      orderBy: { targetDate: "asc" },
    });
  }),

  create: workspaceProcedure
    .input(
      z.object({
        name: z.string().min(1).max(300),
        description: z.string().optional(),
        targetDate: z.string().optional(),
        kpiDescription: z.string().optional(),
        kpiTarget: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { targetDate, ...data } = input;
      const objective = await ctx.db.objective.create({
        data: {
          ...data,
          workspaceId: ctx.workspaceId,
          targetDate: targetDate ? new Date(targetDate) : null,
        },
      });

      auditLog(ctx, {
        action: "CREATE",
        entityType: "Objective",
        entityId: objective.id,
        after: objective as unknown as Record<string, unknown>,
      });
      return objective;
    }),

  update: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(300).optional(),
        description: z.string().nullable().optional(),
        targetDate: z.string().nullable().optional(),
        kpiDescription: z.string().nullable().optional(),
        kpiTarget: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.objective.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, targetDate, ...data } = input;
      const updated = await ctx.db.objective.update({
        where: { id },
        data: {
          ...data,
          ...(targetDate !== undefined
            ? { targetDate: targetDate ? new Date(targetDate) : null }
            : {}),
        },
      });

      auditLog(ctx, {
        action: "UPDATE",
        entityType: "Objective",
        entityId: id,
        before: existing as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.objective.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.objective.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      auditLog(ctx, {
        action: "DELETE",
        entityType: "Objective",
        entityId: input.id,
        before: existing as unknown as Record<string, unknown>,
      });
      return { success: true };
    }),
});
