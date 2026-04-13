import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";
import type { ApplicationLifecycle, RationalizationStatus, CostModel } from "@/generated/prisma/client";

const ApplicationCreateInput = z.object({
  name: z.string().min(1).max(300),
  description: z.string().optional(),
  alias: z.string().optional(),
  vendor: z.string().optional(),
  version: z.string().optional(),
  applicationType: z.enum(["SAAS", "COTS", "CUSTOM", "PAAS", "OPEN_SOURCE", "LEGACY"]).default("CUSTOM"),
  deploymentModel: z.enum(["CLOUD_PUBLIC", "CLOUD_PRIVATE", "ON_PREMISE", "HYBRID", "SAAS_HOSTED", "UNKNOWN"]).default("UNKNOWN"),
  lifecycle: z.enum(["PLANNED", "ACTIVE", "PHASING_OUT", "RETIRED", "SUNSET"]).default("ACTIVE"),
  lifecycleStartDate: z.string().optional(),
  lifecycleEndDate: z.string().optional(),
  businessValue: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "BV_UNKNOWN"]).default("BV_UNKNOWN"),
  technicalHealth: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR", "TH_CRITICAL", "TH_UNKNOWN"]).default("TH_UNKNOWN"),
  rationalizationStatus: z.enum(["KEEP", "INVEST", "MIGRATE", "RETIRE", "CONSOLIDATE", "EVALUATE", "RAT_NOT_ASSESSED"]).default("RAT_NOT_ASSESSED"),
  annualCostUsd: z.number().positive().optional(),
  costCurrency: z.string().default("USD"),
  costModel: z.enum(["LICENSE_PER_USER", "LICENSE_FLAT", "SUBSCRIPTION", "USAGE_BASED", "OPEN_SOURCE", "INTERNAL"]).optional(),
  costNotes: z.string().optional(),
  costRenewalDate: z.string().optional(),
  licensedUsers: z.number().int().positive().optional(),
  businessOwnerName: z.string().optional(),
  itOwnerName: z.string().optional(),
  capabilityIds: z.array(z.string()).optional(),
});

const ApplicationUpdateInput = z.object({
  id: z.string(),
  name: z.string().min(1).max(300).optional(),
  description: z.string().nullable().optional(),
  alias: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  version: z.string().nullable().optional(),
  applicationType: z.enum(["SAAS", "COTS", "CUSTOM", "PAAS", "OPEN_SOURCE", "LEGACY"]).optional(),
  deploymentModel: z.enum(["CLOUD_PUBLIC", "CLOUD_PRIVATE", "ON_PREMISE", "HYBRID", "SAAS_HOSTED", "UNKNOWN"]).optional(),
  lifecycle: z.enum(["PLANNED", "ACTIVE", "PHASING_OUT", "RETIRED", "SUNSET"]).optional(),
  lifecycleEndDate: z.string().nullable().optional(),
  businessValue: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "BV_UNKNOWN"]).optional(),
  technicalHealth: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR", "TH_CRITICAL", "TH_UNKNOWN"]).optional(),
  rationalizationStatus: z.enum(["KEEP", "INVEST", "MIGRATE", "RETIRE", "CONSOLIDATE", "EVALUATE", "RAT_NOT_ASSESSED"]).optional(),
  annualCostUsd: z.number().positive().nullable().optional(),
  costCurrency: z.string().optional(),
  costModel: z.enum(["LICENSE_PER_USER", "LICENSE_FLAT", "SUBSCRIPTION", "USAGE_BASED", "OPEN_SOURCE", "INTERNAL"]).nullable().optional(),
  costNotes: z.string().nullable().optional(),
  costRenewalDate: z.string().nullable().optional(),
  licensedUsers: z.number().int().positive().nullable().optional(),
  businessOwnerName: z.string().nullable().optional(),
  itOwnerName: z.string().nullable().optional(),
  capabilityIds: z.array(z.string()).optional(),
});

const AssessInput = z.object({
  applicationId: z.string(),
  businessValue: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "BV_UNKNOWN"]),
  technicalHealth: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR", "TH_CRITICAL", "TH_UNKNOWN"]),
  rationalizationStatus: z.enum(["KEEP", "INVEST", "MIGRATE", "RETIRE", "CONSOLIDATE", "EVALUATE", "RAT_NOT_ASSESSED"]),
  notes: z.string().optional(),
});

export const applicationRouter = router({
  list: workspaceProcedure
    .input(
      z.object({
        lifecycle: z.string().optional(),
        rationalization: z.string().optional(),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.application.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
          ...(input?.lifecycle ? { lifecycle: input.lifecycle as ApplicationLifecycle } : {}),
          ...(input?.rationalization ? { rationalizationStatus: input.rationalization as RationalizationStatus } : {}),
          ...(input?.search ? { name: { contains: input.search, mode: "insensitive" as const } } : {}),
        },
        include: {
          capabilities: { select: { capabilityId: true, supportType: true } },
          assessments: { orderBy: { assessedAt: "desc" }, take: 1 },
        },
        orderBy: [{ name: "asc" }],
      });
    }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const app = await ctx.db.application.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: {
          capabilities: { include: { capability: { select: { id: true, name: true, level: true } } } },
          assessments: { orderBy: { assessedAt: "desc" }, take: 5 },
          owner: { select: { id: true, name: true, avatarUrl: true } },
        },
      });
      if (!app) throw new TRPCError({ code: "NOT_FOUND" });
      return app;
    }),

  create: workspaceProcedure
    .input(ApplicationCreateInput)
    .mutation(async ({ ctx, input }) => {
      const { capabilityIds, lifecycleStartDate, lifecycleEndDate, annualCostUsd, costRenewalDate, ...data } = input;

      const app = await ctx.db.application.create({
        data: {
          ...data,
          workspaceId: ctx.workspaceId,
          annualCostUsd: annualCostUsd ?? null,
          costRenewalDate: costRenewalDate ? new Date(costRenewalDate) : null,
          lifecycleStartDate: lifecycleStartDate ? new Date(lifecycleStartDate) : null,
          lifecycleEndDate: lifecycleEndDate ? new Date(lifecycleEndDate) : null,
          capabilities: capabilityIds?.length
            ? { create: capabilityIds.map((capabilityId) => ({ capabilityId, workspaceId: ctx.workspaceId })) }
            : undefined,
        },
      });
      auditLog(ctx, { action: "CREATE", entityType: "Application", entityId: app.id, after: app as any });
      return app;
    }),

  update: workspaceProcedure
    .input(ApplicationUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, capabilityIds, lifecycleEndDate, annualCostUsd, costRenewalDate, ...data } = input;

      const existing = await ctx.db.application.findFirst({
        where: { id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.$transaction(async (tx) => {
        if (capabilityIds !== undefined) {
          await tx.applicationCapabilityMap.deleteMany({ where: { applicationId: id } });
          if (capabilityIds.length > 0) {
            await tx.applicationCapabilityMap.createMany({
              data: capabilityIds.map((capabilityId) => ({
                applicationId: id,
                capabilityId,
                workspaceId: ctx.workspaceId,
              })),
            });
          }
        }
        return tx.application.update({
          where: { id },
          data: {
            ...data,
            ...(lifecycleEndDate !== undefined
              ? { lifecycleEndDate: lifecycleEndDate ? new Date(lifecycleEndDate) : null }
              : {}),
            ...(annualCostUsd !== undefined
              ? { annualCostUsd: annualCostUsd ?? null }
              : {}),
            ...(costRenewalDate !== undefined
              ? { costRenewalDate: costRenewalDate ? new Date(costRenewalDate) : null }
              : {}),
          },
        });
      });
      return updated;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.application.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.application.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      auditLog(ctx, { action: "DELETE", entityType: "Application", entityId: input.id, before: existing as any });
      return { success: true };
    }),

  assess: workspaceProcedure
    .input(AssessInput)
    .mutation(async ({ ctx, input }) => {
      const { applicationId, ...assessData } = input;
      const app = await ctx.db.application.findFirst({
        where: { id: applicationId, workspaceId: ctx.workspaceId },
      });
      if (!app) throw new TRPCError({ code: "NOT_FOUND" });

      const [assessment] = await ctx.db.$transaction([
        ctx.db.applicationAssessment.create({
          data: { applicationId, ...assessData },
        }),
        ctx.db.application.update({
          where: { id: applicationId },
          data: {
            businessValue: assessData.businessValue,
            technicalHealth: assessData.technicalHealth,
            rationalizationStatus: assessData.rationalizationStatus,
          },
        }),
      ]);
      return assessment;
    }),

  getRationalizationMatrix: workspaceProcedure.query(async ({ ctx }) => {
    const apps = await ctx.db.application.findMany({
      where: { workspaceId: ctx.workspaceId, isActive: true },
      include: { capabilities: true },
    });

    // Redundancy: capabilities with multiple apps
    const capAppMap = new Map<string, string[]>();
    for (const app of apps) {
      for (const cap of app.capabilities) {
        const existing = capAppMap.get(cap.capabilityId) ?? [];
        capAppMap.set(cap.capabilityId, [...existing, app.id]);
      }
    }
    const redundancies = Array.from(capAppMap.entries())
      .filter(([, ids]) => ids.length > 1)
      .map(([capabilityId, applicationIds]) => ({ capabilityId, applicationIds, count: applicationIds.length }));

    // Retire candidates
    const retireCandidates = apps.filter(
      (a) =>
        (a.businessValue === "LOW" || a.businessValue === "BV_UNKNOWN") &&
        (a.technicalHealth === "POOR" || a.technicalHealth === "TH_CRITICAL")
    );

    // Orphaned apps (no capability mappings)
    const orphanedApps = apps.filter((a) => a.capabilities.length === 0);

    // Cost by rationalization status
    const costByStatus = apps.reduce((acc, a) => {
      const status = a.rationalizationStatus;
      const cost = Number(a.annualCostUsd ?? 0);
      acc[status] = (acc[status] ?? 0) + cost;
      return acc;
    }, {} as Record<string, number>);

    return { redundancies, retireCandidates, orphanedApps, costByStatus, totalApps: apps.length };
  }),

  // ─── AI Mapping: context loader ─────────────────────────
  getAIMappingContext: workspaceProcedure
    .input(z.object({ applicationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [app, capabilities, workspace, rejectedPairs] = await Promise.all([
        ctx.db.application.findFirst({
          where: { id: input.applicationId, workspaceId: ctx.workspaceId },
          include: {
            capabilities: { select: { capabilityId: true } },
          },
        }),
        ctx.db.businessCapability.findMany({
          where: { workspaceId: ctx.workspaceId, isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            level: true,
            parentId: true,
            strategicImportance: true,
          },
          orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
        }),
        ctx.db.workspace.findFirst({ where: { id: ctx.workspaceId } }),
        ctx.db.aIMappingFeedback.findMany({
          where: {
            workspaceId: ctx.workspaceId,
            applicationId: input.applicationId,
            userAction: "REJECTED",
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
          select: { capabilityId: true },
        }),
      ]);

      if (!app) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        application: app,
        capabilities,
        workspace,
        existingCapabilityIds: app.capabilities.map((c) => c.capabilityId),
        recentlyRejectedCapabilityIds: rejectedPairs.map((r) => r.capabilityId),
      };
    }),

  bulkGetAIMappingContext: workspaceProcedure
    .input(z.object({ applicationIds: z.array(z.string()).max(30) }))
    .query(async ({ ctx, input }) => {
      const [apps, capabilities, workspace, rejectedPairs] = await Promise.all([
        ctx.db.application.findMany({
          where: {
            id: { in: input.applicationIds },
            workspaceId: ctx.workspaceId,
          },
          include: {
            capabilities: { select: { capabilityId: true } },
          },
        }),
        ctx.db.businessCapability.findMany({
          where: { workspaceId: ctx.workspaceId, isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            level: true,
            parentId: true,
            strategicImportance: true,
          },
          orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
        }),
        ctx.db.workspace.findFirst({ where: { id: ctx.workspaceId } }),
        ctx.db.aIMappingFeedback.findMany({
          where: {
            workspaceId: ctx.workspaceId,
            applicationId: { in: input.applicationIds },
            userAction: "REJECTED",
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
          select: { applicationId: true, capabilityId: true },
        }),
      ]);

      const rejectedMap: Record<string, string[]> = {};
      for (const r of rejectedPairs) {
        (rejectedMap[r.applicationId] ||= []).push(r.capabilityId);
      }

      return {
        applications: apps.map((a) => ({
          ...a,
          existingCapabilityIds: a.capabilities.map((c) => c.capabilityId),
          recentlyRejectedCapabilityIds: rejectedMap[a.id] ?? [],
        })),
        capabilities,
        workspace,
      };
    }),

  listForMapping: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db.application.findMany({
      where: { workspaceId: ctx.workspaceId, isActive: true },
      select: {
        id: true,
        name: true,
        vendor: true,
        applicationType: true,
        lifecycle: true,
        capabilities: { select: { capabilityId: true } },
      },
      orderBy: { name: "asc" },
    });
  }),

  // ─── AI Mapping: accept / reject / modify ───────────────
  acceptAISuggestion: workspaceProcedure
    .input(
      z.object({
        applicationId: z.string(),
        capabilityId: z.string(),
        aiConfidence: z.number().int().min(0).max(100),
        aiRationale: z.string(),
        aiRelationshipType: z.enum(["PRIMARY", "SUPPORTING", "ENABLING"]),
        promptVersion: z.string(),
        model: z.string(),
        tier: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.applicationCapabilityMap.upsert({
        where: {
          applicationId_capabilityId: {
            applicationId: input.applicationId,
            capabilityId: input.capabilityId,
          },
        },
        create: {
          applicationId: input.applicationId,
          capabilityId: input.capabilityId,
          workspaceId: ctx.workspaceId,
          source: "AI_ACCEPTED",
          relationshipType: input.aiRelationshipType,
          aiConfidence: input.aiConfidence,
          aiRationale: input.aiRationale,
          aiModel: input.model,
          aiPromptVersion: input.promptVersion,
          createdById: ctx.dbUserId,
        },
        update: {
          source: "AI_ACCEPTED",
          relationshipType: input.aiRelationshipType,
          aiConfidence: input.aiConfidence,
          aiRationale: input.aiRationale,
          aiModel: input.model,
          aiPromptVersion: input.promptVersion,
        },
      });

      await ctx.db.aIMappingFeedback.create({
        data: {
          workspaceId: ctx.workspaceId,
          applicationId: input.applicationId,
          capabilityId: input.capabilityId,
          aiConfidence: input.aiConfidence,
          aiRationale: input.aiRationale,
          aiRelationshipType: input.aiRelationshipType,
          userAction: "ACCEPTED",
          promptVersion: input.promptVersion,
          model: input.model,
          tier: input.tier,
          createdById: ctx.dbUserId,
        },
      });

      return { success: true };
    }),

  rejectAISuggestion: workspaceProcedure
    .input(
      z.object({
        applicationId: z.string(),
        capabilityId: z.string(),
        aiConfidence: z.number().int().min(0).max(100),
        aiRationale: z.string(),
        aiRelationshipType: z.enum(["PRIMARY", "SUPPORTING", "ENABLING"]),
        userNote: z.string().optional(),
        promptVersion: z.string(),
        model: z.string(),
        tier: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.aIMappingFeedback.create({
        data: {
          workspaceId: ctx.workspaceId,
          applicationId: input.applicationId,
          capabilityId: input.capabilityId,
          aiConfidence: input.aiConfidence,
          aiRationale: input.aiRationale,
          aiRelationshipType: input.aiRelationshipType,
          userAction: "REJECTED",
          userNote: input.userNote,
          promptVersion: input.promptVersion,
          model: input.model,
          tier: input.tier,
          createdById: ctx.dbUserId,
        },
      });
      return { success: true };
    }),

  modifyAISuggestion: workspaceProcedure
    .input(
      z.object({
        applicationId: z.string(),
        originalCapabilityId: z.string(),
        finalCapabilityId: z.string(),
        aiConfidence: z.number().int().min(0).max(100),
        aiRationale: z.string(),
        aiRelationshipType: z.enum(["PRIMARY", "SUPPORTING", "ENABLING"]),
        userRelationshipType: z.enum(["PRIMARY", "SUPPORTING", "ENABLING"]),
        userNote: z.string().optional(),
        promptVersion: z.string(),
        model: z.string(),
        tier: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.applicationCapabilityMap.upsert({
        where: {
          applicationId_capabilityId: {
            applicationId: input.applicationId,
            capabilityId: input.finalCapabilityId,
          },
        },
        create: {
          applicationId: input.applicationId,
          capabilityId: input.finalCapabilityId,
          workspaceId: ctx.workspaceId,
          source: "AI_MODIFIED",
          relationshipType: input.userRelationshipType,
          aiConfidence: input.aiConfidence,
          aiRationale: input.aiRationale,
          aiModel: input.model,
          aiPromptVersion: input.promptVersion,
          createdById: ctx.dbUserId,
        },
        update: {
          source: "AI_MODIFIED",
          relationshipType: input.userRelationshipType,
        },
      });

      await ctx.db.aIMappingFeedback.create({
        data: {
          workspaceId: ctx.workspaceId,
          applicationId: input.applicationId,
          capabilityId: input.originalCapabilityId,
          userCapabilityId:
            input.finalCapabilityId !== input.originalCapabilityId
              ? input.finalCapabilityId
              : null,
          aiConfidence: input.aiConfidence,
          aiRationale: input.aiRationale,
          aiRelationshipType: input.aiRelationshipType,
          userAction: "MODIFIED",
          userRelationshipType: input.userRelationshipType,
          userNote: input.userNote,
          promptVersion: input.promptVersion,
          model: input.model,
          tier: input.tier,
          createdById: ctx.dbUserId,
        },
      });

      return { success: true };
    }),

  getStats: workspaceProcedure.query(async ({ ctx }) => {
    const apps = await ctx.db.application.findMany({
      where: { workspaceId: ctx.workspaceId, isActive: true },
      select: {
        lifecycle: true,
        applicationType: true,
        rationalizationStatus: true,
        technicalHealth: true,
        businessValue: true,
        annualCostUsd: true,
      },
    });

    const byLifecycle: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byRationalization: Record<string, number> = {};
    const byHealth: Record<string, number> = {};
    let totalCost = 0;

    for (const app of apps) {
      byLifecycle[app.lifecycle] = (byLifecycle[app.lifecycle] ?? 0) + 1;
      byType[app.applicationType] = (byType[app.applicationType] ?? 0) + 1;
      byRationalization[app.rationalizationStatus] = (byRationalization[app.rationalizationStatus] ?? 0) + 1;
      byHealth[app.technicalHealth] = (byHealth[app.technicalHealth] ?? 0) + 1;
      totalCost += Number(app.annualCostUsd ?? 0);
    }

    return { byLifecycle, byType, byRationalization, byHealth, totalCost, totalApps: apps.length };
  }),
});
