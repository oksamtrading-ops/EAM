import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";

export const versionRouter = router({
  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db.capabilityMapVersion.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { createdBy: { select: { name: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }),

  save: workspaceProcedure
    .input(
      z.object({
        label: z.string().min(1).max(100),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const snapshot = await captureSnapshot(ctx.db, ctx.workspaceId);
      return ctx.db.capabilityMapVersion.create({
        data: {
          workspaceId: ctx.workspaceId,
          label: input.label,
          description: input.description,
          snapshot,
          createdById: ctx.userId,
          isAutomatic: false,
        },
      });
    }),

  restore: workspaceProcedure
    .input(z.object({ versionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const version = await ctx.db.capabilityMapVersion.findFirst({
        where: { id: input.versionId, workspaceId: ctx.workspaceId },
      });
      if (!version) throw new TRPCError({ code: "NOT_FOUND" });

      // Auto-save current state before restoring
      const currentSnapshot = await captureSnapshot(ctx.db, ctx.workspaceId);
      await ctx.db.capabilityMapVersion.create({
        data: {
          workspaceId: ctx.workspaceId,
          label: `Auto: Before restore to "${version.label}"`,
          snapshot: currentSnapshot,
          createdById: ctx.userId,
          isAutomatic: true,
        },
      });

      // Soft-delete all current capabilities
      await ctx.db.businessCapability.updateMany({
        where: { workspaceId: ctx.workspaceId },
        data: { isActive: false },
      });

      // Replay snapshot
      const snap = version.snapshot as any;
      await replaySnapshot(ctx.db, ctx.workspaceId, snap);

      return { restored: true, fromLabel: version.label };
    }),

  preview: workspaceProcedure
    .input(z.object({ versionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const version = await ctx.db.capabilityMapVersion.findFirst({
        where: { id: input.versionId, workspaceId: ctx.workspaceId },
      });
      if (!version) throw new TRPCError({ code: "NOT_FOUND" });
      return version.snapshot;
    }),
});

async function captureSnapshot(db: any, workspaceId: string) {
  const capabilities = await db.businessCapability.findMany({
    where: { workspaceId, isActive: true },
    include: { tags: { include: { tag: true } } },
  });

  return {
    version: 1,
    capturedAt: new Date().toISOString(),
    capabilities: capabilities.map((c: any) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      level: c.level,
      parentId: c.parentId,
      sortOrder: c.sortOrder,
      strategicImportance: c.strategicImportance,
      currentMaturity: c.currentMaturity,
      targetMaturity: c.targetMaturity,
      organizationId: c.organizationId,
      ownerId: c.ownerId,
      tags: c.tags.map((t: any) => t.tag.name),
      externalId: c.externalId,
    })),
  };
}

async function replaySnapshot(db: any, workspaceId: string, snap: any) {
  const oldIdToNewId = new Map<string, string>();

  for (const level of ["L1", "L2", "L3"] as const) {
    const caps = (snap.capabilities ?? []).filter((c: any) => c.level === level);
    for (const cap of caps) {
      const newParentId = cap.parentId ? oldIdToNewId.get(cap.parentId) : null;
      const created = await db.businessCapability.create({
        data: {
          workspaceId,
          name: cap.name,
          description: cap.description,
          level: cap.level,
          parentId: newParentId ?? null,
          sortOrder: cap.sortOrder,
          strategicImportance: cap.strategicImportance,
          currentMaturity: cap.currentMaturity,
          targetMaturity: cap.targetMaturity,
          externalId: cap.externalId,
        },
      });
      oldIdToNewId.set(cap.id, created.id);
    }
  }
}
