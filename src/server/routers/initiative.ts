import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";

const InitiativeCreateInput = z.object({
  name: z.string().min(1).max(300),
  description: z.string().optional(),
  category: z
    .enum([
      "MODERNISATION",
      "CONSOLIDATION",
      "DIGITALISATION",
      "COMPLIANCE",
      "OPTIMISATION",
      "INNOVATION",
      "DECOMMISSION",
    ])
    .default("MODERNISATION"),
  status: z
    .enum(["DRAFT", "PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETE", "CANCELLED"])
    .default("DRAFT"),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  horizon: z.enum(["H1_NOW", "H2_NEXT", "H3_LATER", "BEYOND"]).default("H2_NEXT"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budgetUsd: z.number().positive().optional(),
  budgetCurrency: z.string().default("USD"),
  ownerId: z.string().optional(),
  businessSponsor: z.string().optional(),
  capabilityMaps: z
    .array(
      z.object({
        capabilityId: z.string(),
        impactType: z
          .enum(["IMPROVES", "ENABLES", "RETIRES", "INTRODUCES"])
          .default("IMPROVES"),
        targetMaturity: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .optional(),
  applicationMaps: z
    .array(
      z.object({
        applicationId: z.string(),
        changeType: z
          .enum(["INTRODUCES", "RETIRES", "REPLACES", "MODIFIES", "MIGRATES_FROM", "MIGRATES_TO"])
          .default("MODIFIES"),
        notes: z.string().optional(),
      })
    )
    .optional(),
  objectiveIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
});

const InitiativeUpdateInput = z.object({
  id: z.string(),
  name: z.string().min(1).max(300).optional(),
  description: z.string().nullable().optional(),
  category: z
    .enum([
      "MODERNISATION",
      "CONSOLIDATION",
      "DIGITALISATION",
      "COMPLIANCE",
      "OPTIMISATION",
      "INNOVATION",
      "DECOMMISSION",
    ])
    .optional(),
  status: z
    .enum(["DRAFT", "PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETE", "CANCELLED"])
    .optional(),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  horizon: z.enum(["H1_NOW", "H2_NEXT", "H3_LATER", "BEYOND"]).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  budgetUsd: z.number().positive().nullable().optional(),
  budgetCurrency: z.string().optional(),
  ownerId: z.string().nullable().optional(),
  businessSponsor: z.string().nullable().optional(),
  ragStatus: z.enum(["RED", "AMBER", "GREEN"]).optional(),
  progressPct: z.number().int().min(0).max(100).optional(),
  capabilityMaps: z
    .array(
      z.object({
        capabilityId: z.string(),
        impactType: z
          .enum(["IMPROVES", "ENABLES", "RETIRES", "INTRODUCES"])
          .default("IMPROVES"),
        targetMaturity: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .optional(),
  applicationMaps: z
    .array(
      z.object({
        applicationId: z.string(),
        changeType: z
          .enum(["INTRODUCES", "RETIRES", "REPLACES", "MODIFIES", "MIGRATES_FROM", "MIGRATES_TO"])
          .default("MODIFIES"),
        notes: z.string().optional(),
      })
    )
    .optional(),
  objectiveIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
});

const DependencyInput = z.object({
  dependentId: z.string(),
  blockingId: z.string(),
  dependencyType: z
    .enum(["FINISH_TO_START", "FINISH_TO_FINISH", "START_TO_START"])
    .default("FINISH_TO_START"),
  lagDays: z.number().int().min(0).default(0),
  notes: z.string().optional(),
});

export const initiativeRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({
          status: z
            .enum(["DRAFT", "PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETE", "CANCELLED"])
            .optional(),
          horizon: z.enum(["H1_NOW", "H2_NEXT", "H3_LATER", "BEYOND"]).optional(),
          priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
          capabilityId: z.string().optional(),
          applicationId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.initiative.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.horizon ? { horizon: input.horizon } : {}),
          ...(input?.priority ? { priority: input.priority } : {}),
          ...(input?.capabilityId
            ? { capabilities: { some: { capabilityId: input.capabilityId } } }
            : {}),
          ...(input?.applicationId
            ? { applications: { some: { applicationId: input.applicationId } } }
            : {}),
        },
        include: {
          milestones: { orderBy: { sortOrder: "asc" } },
          capabilities: true,
          applications: true,
          objectives: {
            include: { objective: { select: { id: true, name: true } } },
          },
          dependsOn: {
            include: {
              blocking: { select: { id: true, name: true, status: true } },
            },
          },
          blockedBy: {
            include: {
              dependent: { select: { id: true, name: true, status: true } },
            },
          },
          tags: { include: { tag: true } },
          owner: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { milestones: true } },
        },
        orderBy: [{ horizon: "asc" }, { priority: "desc" }, { startDate: "asc" }],
      });
    }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const initiative = await ctx.db.initiative.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId, isActive: true },
        include: {
          milestones: {
            include: {
              blockedBy: {
                include: {
                  blocking: { select: { id: true, name: true, status: true } },
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
          capabilities: true,
          applications: true,
          objectives: { include: { objective: true } },
          dependsOn: { include: { blocking: true } },
          blockedBy: { include: { dependent: true } },
          archStates: { orderBy: { createdAt: "desc" } },
          tags: { include: { tag: true } },
          owner: true,
        },
      });
      if (!initiative) throw new TRPCError({ code: "NOT_FOUND" });
      return initiative;
    }),

  create: workspaceProcedure
    .input(InitiativeCreateInput)
    .mutation(async ({ ctx, input }) => {
      const {
        capabilityMaps,
        applicationMaps,
        objectiveIds,
        tagIds,
        budgetUsd,
        startDate,
        endDate,
        ...data
      } = input;

      const initiative = await ctx.db.initiative.create({
        data: {
          ...data,
          workspaceId: ctx.workspaceId,
          budgetUsd: budgetUsd ?? null,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          capabilities: capabilityMaps?.length
            ? {
                create: capabilityMaps.map((m) => ({
                  ...m,
                  workspaceId: ctx.workspaceId,
                })),
              }
            : undefined,
          applications: applicationMaps?.length
            ? {
                create: applicationMaps.map((m) => ({
                  ...m,
                  workspaceId: ctx.workspaceId,
                })),
              }
            : undefined,
          objectives: objectiveIds?.length
            ? { create: objectiveIds.map((objectiveId) => ({ objectiveId })) }
            : undefined,
          tags: tagIds?.length
            ? { create: tagIds.map((tagId) => ({ tagId })) }
            : undefined,
        },
      });

      auditLog(ctx, {
        action: "CREATE",
        entityType: "Initiative",
        entityId: initiative.id,
        after: initiative as unknown as Record<string, unknown>,
      });
      return initiative;
    }),

  update: workspaceProcedure
    .input(InitiativeUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.initiative.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const {
        id,
        capabilityMaps,
        applicationMaps,
        objectiveIds,
        tagIds,
        budgetUsd,
        startDate,
        endDate,
        ...data
      } = input;

      const updated = await ctx.db.$transaction(async (tx) => {
        if (capabilityMaps !== undefined) {
          await tx.initiativeCapabilityMap.deleteMany({ where: { initiativeId: id } });
          if (capabilityMaps.length > 0) {
            await tx.initiativeCapabilityMap.createMany({
              data: capabilityMaps.map((m) => ({
                ...m,
                initiativeId: id,
                workspaceId: ctx.workspaceId,
              })),
            });
          }
        }
        if (applicationMaps !== undefined) {
          await tx.initiativeApplicationMap.deleteMany({ where: { initiativeId: id } });
          if (applicationMaps.length > 0) {
            await tx.initiativeApplicationMap.createMany({
              data: applicationMaps.map((m) => ({
                ...m,
                initiativeId: id,
                workspaceId: ctx.workspaceId,
              })),
            });
          }
        }
        if (objectiveIds !== undefined) {
          await tx.initiativeObjectiveMap.deleteMany({ where: { initiativeId: id } });
          if (objectiveIds.length > 0) {
            await tx.initiativeObjectiveMap.createMany({
              data: objectiveIds.map((objectiveId) => ({ initiativeId: id, objectiveId })),
            });
          }
        }
        if (tagIds !== undefined) {
          await tx.initiativeTagMap.deleteMany({ where: { initiativeId: id } });
          if (tagIds.length > 0) {
            await tx.initiativeTagMap.createMany({
              data: tagIds.map((tagId) => ({ initiativeId: id, tagId })),
            });
          }
        }
        return tx.initiative.update({
          where: { id },
          data: {
            ...data,
            ...(budgetUsd !== undefined ? { budgetUsd: budgetUsd ?? null } : {}),
            ...(startDate !== undefined
              ? { startDate: startDate ? new Date(startDate) : null }
              : {}),
            ...(endDate !== undefined
              ? { endDate: endDate ? new Date(endDate) : null }
              : {}),
          },
        });
      });

      auditLog(ctx, {
        action: "UPDATE",
        entityType: "Initiative",
        entityId: id,
        before: existing as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  updateStatus: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["DRAFT", "PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETE", "CANCELLED"]),
        ragStatus: z.enum(["RED", "AMBER", "GREEN"]).optional(),
        progressPct: z.number().int().min(0).max(100).optional(),
        cancellationReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.initiative.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.initiative.update({
        where: { id: input.id },
        data: {
          status: input.status,
          ragStatus: input.ragStatus ?? existing.ragStatus,
          progressPct: input.progressPct ?? existing.progressPct,
          ...(input.cancellationReason ? { cancellationReason: input.cancellationReason } : {}),
        },
      });

      auditLog(ctx, {
        action: "UPDATE",
        entityType: "Initiative",
        entityId: input.id,
        before: { status: existing.status } as Record<string, unknown>,
        after: { status: input.status } as Record<string, unknown>,
      });
      return updated;
    }),

  addDependency: workspaceProcedure
    .input(DependencyInput)
    .mutation(async ({ ctx, input }) => {
      if (input.dependentId === input.blockingId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An initiative cannot depend on itself.",
        });
      }

      const wouldCreateCycle = await detectCycle(
        ctx.db,
        ctx.workspaceId,
        input.dependentId,
        input.blockingId
      );
      if (wouldCreateCycle) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This dependency would create a circular dependency chain.",
        });
      }

      const dep = await ctx.db.initiativeDependency.create({
        data: { ...input, workspaceId: ctx.workspaceId },
      });

      auditLog(ctx, {
        action: "UPDATE",
        entityType: "Initiative",
        entityId: input.dependentId,
        after: { addedDependency: input.blockingId } as Record<string, unknown>,
      });
      return dep;
    }),

  removeDependency: workspaceProcedure
    .input(z.object({ dependentId: z.string(), blockingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.initiativeDependency.deleteMany({
        where: {
          dependentId: input.dependentId,
          blockingId: input.blockingId,
          workspaceId: ctx.workspaceId,
        },
      });
      auditLog(ctx, {
        action: "UPDATE",
        entityType: "Initiative",
        entityId: input.dependentId,
        after: { removedDependency: input.blockingId } as Record<string, unknown>,
      });
      return { success: true };
    }),

  getRoadmapData: workspaceProcedure.query(async ({ ctx }) => {
    const initiatives = await ctx.db.initiative.findMany({
      where: { workspaceId: ctx.workspaceId, isActive: true },
      include: {
        milestones: { orderBy: { dueDate: "asc" } },
        capabilities: true,
        applications: true,
        dependsOn: {
          include: {
            blocking: { select: { id: true, name: true, status: true } },
          },
        },
        tags: { include: { tag: true } },
      },
      orderBy: [{ startDate: "asc" }, { priority: "desc" }],
    });

    const now = new Date();
    const MS_PER_MONTH = 30 * 24 * 60 * 60 * 1000;
    const horizonBoundaries = {
      H1_NOW: new Date(now.getTime() + 6 * MS_PER_MONTH),
      H2_NEXT: new Date(now.getTime() + 18 * MS_PER_MONTH),
      H3_LATER: new Date(now.getTime() + 36 * MS_PER_MONTH),
    };

    return { initiatives, horizonBoundaries, now };
  }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.initiative.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.initiative.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      auditLog(ctx, {
        action: "DELETE",
        entityType: "Initiative",
        entityId: input.id,
        before: existing as unknown as Record<string, unknown>,
      });
      return { success: true };
    }),
});

async function detectCycle(
  db: any,
  workspaceId: string,
  dependentId: string,
  blockingId: string
): Promise<boolean> {
  const visited = new Set<string>();
  const queue = [blockingId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === dependentId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = await db.initiativeDependency.findMany({
      where: { blockingId: current, workspaceId },
      select: { dependentId: true },
    });
    queue.push(...deps.map((d: { dependentId: string }) => d.dependentId));
  }
  return false;
}
