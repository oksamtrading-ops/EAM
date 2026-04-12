import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";
import { eolUrgencyBand, URGENCY_BAND_ORDER } from "@/server/services/riskScoring";

const URGENCY_BANDS = ["EXPIRED", "URGENT", "WARNING", "APPROACHING", "PLANNED", "HEALTHY"] as const;

export const eolRouter = router({
  list: workspaceProcedure
    .input(
      z.object({
        urgencyBand: z.enum(URGENCY_BANDS).optional(),
        entityType: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const entries = await ctx.db.eolWatchEntry.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...(input?.urgencyBand ? { urgencyBand: input.urgencyBand } : {}),
          ...(input?.entityType ? { entityType: input.entityType } : {}),
        },
        include: {
          acknowledgedBy: { select: { id: true, name: true } },
        },
        orderBy: { eolDate: "asc" },
      });
      return entries;
    }),

  syncFromPortfolio: workspaceProcedure.mutation(async ({ ctx }) => {
    const apps = await ctx.db.application.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        isActive: true,
      },
      include: { _count: { select: { capabilities: true } } },
    });

    let upserted = 0;
    for (const app of apps) {
      const eolDate = app.lifecycleEndDate ?? null;
      const urgencyBand = eolUrgencyBand(eolDate);

      // Only track apps with EOL dates or that are sunsetting/retiring
      const hasEolSignal =
        eolDate !== null ||
        app.lifecycle === "PHASING_OUT" ||
        app.lifecycle === "SUNSET" ||
        app.lifecycle === "RETIRED";

      if (!hasEolSignal) continue;

      await ctx.db.eolWatchEntry.upsert({
        where: {
          workspaceId_entityType_entityId: {
            workspaceId: ctx.workspaceId,
            entityType: "Application",
            entityId: app.id,
          },
        },
        create: {
          workspaceId: ctx.workspaceId,
          entityType: "Application",
          entityId: app.id,
          entityName: app.name,
          eolDate,
          vendor: app.vendor ?? null,
          affectedAppCount: 1,
          urgencyBand,
        },
        update: {
          entityName: app.name,
          eolDate,
          vendor: app.vendor ?? null,
          urgencyBand,
        },
      });
      upserted++;
    }

    return { upserted };
  }),

  acknowledge: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        notes: z.string().optional(),
        remediationInitiativeId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.eolWatchEntry.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.eolWatchEntry.update({
        where: { id: input.id },
        data: {
          isAcknowledged: true,
          acknowledgedById: ctx.dbUserId ?? null,
          acknowledgedAt: new Date(),
          notes: input.notes ?? entry.notes,
          remediationInitiativeId: input.remediationInitiativeId ?? entry.remediationInitiativeId,
        },
      });

      auditLog(ctx, {
        action: "UPDATE",
        entityType: "EolWatchEntry",
        entityId: input.id,
        before: { isAcknowledged: false } as Record<string, unknown>,
        after: { isAcknowledged: true } as Record<string, unknown>,
      });
      return updated;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.eolWatchEntry.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.eolWatchEntry.delete({ where: { id: input.id } });

      auditLog(ctx, {
        action: "DELETE",
        entityType: "EolWatchEntry",
        entityId: input.id,
        before: entry as unknown as Record<string, unknown>,
      });
      return { success: true };
    }),

  getSummary: workspaceProcedure.query(async ({ ctx }) => {
    const entries = await ctx.db.eolWatchEntry.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { urgencyBand: true, isAcknowledged: true },
    });

    const byBand: Record<string, number> = {};
    for (const band of ["EXPIRED", "URGENT", "WARNING", "APPROACHING", "PLANNED", "HEALTHY"]) {
      byBand[band] = 0;
    }
    for (const e of entries) {
      byBand[e.urgencyBand] = (byBand[e.urgencyBand] ?? 0) + 1;
    }

    return {
      total: entries.length,
      expired: byBand["EXPIRED"] ?? 0,
      urgent: byBand["URGENT"] ?? 0,
      warning: byBand["WARNING"] ?? 0,
      byBand,
    };
  }),
});
