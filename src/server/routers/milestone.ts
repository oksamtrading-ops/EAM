import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";

export const milestoneRouter = router({
  create: workspaceProcedure
    .input(
      z.object({
        initiativeId: z.string(),
        name: z.string().min(1).max(300),
        description: z.string().optional(),
        dueDate: z.string().optional(),
        ownerId: z.string().optional(),
        isCritical: z.boolean().default(false),
        sortOrder: z.number().int().default(0),
        blockingIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const initiative = await ctx.db.initiative.findFirst({
        where: { id: input.initiativeId, workspaceId: ctx.workspaceId },
      });
      if (!initiative) throw new TRPCError({ code: "NOT_FOUND" });

      const { blockingIds, dueDate, ...data } = input;

      const milestone = await ctx.db.milestone.create({
        data: {
          ...data,
          workspaceId: ctx.workspaceId,
          dueDate: dueDate ? new Date(dueDate) : null,
          blockedBy: blockingIds?.length
            ? { create: blockingIds.map((blockingId) => ({ blockingId })) }
            : undefined,
        },
      });

      auditLog(ctx, {
        action: "CREATE",
        entityType: "Milestone",
        entityId: milestone.id,
        after: milestone as unknown as Record<string, unknown>,
      });
      return milestone;
    }),

  update: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(300).optional(),
        description: z.string().nullable().optional(),
        dueDate: z.string().nullable().optional(),
        status: z
          .enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETE", "BLOCKED", "CANCELLED"])
          .optional(),
        isCritical: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        ownerId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.milestone.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, dueDate, ...data } = input;

      const updated = await ctx.db.milestone.update({
        where: { id },
        data: {
          ...data,
          ...(dueDate !== undefined
            ? { dueDate: dueDate ? new Date(dueDate) : null }
            : {}),
        },
      });

      auditLog(ctx, {
        action: "UPDATE",
        entityType: "Milestone",
        entityId: id,
        before: existing as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  complete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const milestone = await ctx.db.milestone.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!milestone) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.milestone.update({
        where: { id: input.id },
        data: { status: "COMPLETE", completedAt: new Date() },
      });

      await recalculateInitiativeProgress(ctx.db, milestone.initiativeId);

      auditLog(ctx, {
        action: "UPDATE",
        entityType: "Milestone",
        entityId: input.id,
        before: { status: milestone.status } as Record<string, unknown>,
        after: { status: "COMPLETE" } as Record<string, unknown>,
      });
      return updated;
    }),

  reorder: workspaceProcedure
    .input(
      z.object({
        updates: z.array(
          z.object({ id: z.string(), sortOrder: z.number().int() })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(
        input.updates.map((u) =>
          ctx.db.milestone.update({
            where: { id: u.id },
            data: { sortOrder: u.sortOrder },
          })
        )
      );
      return { success: true };
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.milestone.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.milestone.delete({ where: { id: input.id } });

      auditLog(ctx, {
        action: "DELETE",
        entityType: "Milestone",
        entityId: input.id,
        before: existing as unknown as Record<string, unknown>,
      });
      return { success: true };
    }),
});

export async function recalculateInitiativeProgress(
  db: any,
  initiativeId: string
) {
  const milestones = await db.milestone.findMany({
    where: { initiativeId, status: { not: "CANCELLED" } },
    select: { status: true },
  });
  if (milestones.length === 0) return;
  const completed = milestones.filter(
    (m: { status: string }) => m.status === "COMPLETE"
  ).length;
  const progressPct = Math.round((completed / milestones.length) * 100);
  await db.initiative.update({ where: { id: initiativeId }, data: { progressPct } });
}
