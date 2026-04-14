import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";
import type { ApplicationLifecycle, RationalizationStatus, CostModel, FunctionalFitScore } from "@/generated/prisma/client";

const FUNCTIONAL_FIT_VALUES = ["EXCELLENT", "GOOD", "ADEQUATE", "POOR", "UNFIT", "FF_UNKNOWN"] as const;
const DATA_CLASSIFICATION_VALUES = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "DC_UNKNOWN"] as const;
const INTERFACE_PROTOCOL_VALUES = ["REST_API", "SOAP", "GRAPHQL", "FILE_TRANSFER", "DATABASE_LINK", "MESSAGE_QUEUE", "EVENT_STREAM", "ETL", "SFTP", "CUSTOM"] as const;
const INTERFACE_DIRECTION_VALUES = ["INBOUND", "OUTBOUND", "BIDIRECTIONAL"] as const;
const INTERFACE_STATUS_VALUES = ["INT_ACTIVE", "INT_PLANNED", "INT_DEPRECATED", "INT_DECOMMISSIONED"] as const;
const INTERFACE_CRITICALITY_VALUES = ["INT_CRITICAL", "INT_HIGH", "INT_MEDIUM", "INT_LOW"] as const;

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
  rationalizationStatus: z.enum(["TOLERATE", "INVEST", "MIGRATE", "ELIMINATE", "RAT_NOT_ASSESSED"]).default("RAT_NOT_ASSESSED"),
  annualCostUsd: z.number().positive().optional(),
  costCurrency: z.string().default("USD"),
  costModel: z.enum(["LICENSE_PER_USER", "LICENSE_FLAT", "SUBSCRIPTION", "USAGE_BASED", "OPEN_SOURCE", "INTERNAL"]).optional(),
  costNotes: z.string().optional(),
  costRenewalDate: z.string().optional(),
  licensedUsers: z.number().int().positive().optional(),
  businessOwnerName: z.string().optional(),
  itOwnerName: z.string().optional(),
  businessOwnerId: z.string().nullable().optional(),
  itOwnerId: z.string().nullable().optional(),
  functionalFit: z.enum(FUNCTIONAL_FIT_VALUES).default("FF_UNKNOWN"),
  dataClassification: z.enum(DATA_CLASSIFICATION_VALUES).default("DC_UNKNOWN"),
  actualUsers: z.number().int().nonnegative().optional(),
  replacementAppId: z.string().nullable().optional(),
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
  rationalizationStatus: z.enum(["TOLERATE", "INVEST", "MIGRATE", "ELIMINATE", "RAT_NOT_ASSESSED"]).optional(),
  annualCostUsd: z.number().positive().nullable().optional(),
  costCurrency: z.string().optional(),
  costModel: z.enum(["LICENSE_PER_USER", "LICENSE_FLAT", "SUBSCRIPTION", "USAGE_BASED", "OPEN_SOURCE", "INTERNAL"]).nullable().optional(),
  costNotes: z.string().nullable().optional(),
  costRenewalDate: z.string().nullable().optional(),
  licensedUsers: z.number().int().positive().nullable().optional(),
  businessOwnerName: z.string().nullable().optional(),
  itOwnerName: z.string().nullable().optional(),
  businessOwnerId: z.string().nullable().optional(),
  itOwnerId: z.string().nullable().optional(),
  functionalFit: z.enum(FUNCTIONAL_FIT_VALUES).optional(),
  dataClassification: z.enum(DATA_CLASSIFICATION_VALUES).optional(),
  actualUsers: z.number().int().nonnegative().nullable().optional(),
  replacementAppId: z.string().nullable().optional(),
  capabilityIds: z.array(z.string()).optional(),
});

const AssessInput = z.object({
  applicationId: z.string(),
  businessValue: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "BV_UNKNOWN"]),
  technicalHealth: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR", "TH_CRITICAL", "TH_UNKNOWN"]),
  rationalizationStatus: z.enum(["TOLERATE", "INVEST", "MIGRATE", "ELIMINATE", "RAT_NOT_ASSESSED"]),
  functionalFit: z.enum(FUNCTIONAL_FIT_VALUES).optional(),
  notes: z.string().optional(),
});

const InterfaceInput = z.object({
  sourceAppId: z.string(),
  targetAppId: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  protocol: z.enum(INTERFACE_PROTOCOL_VALUES).default("REST_API"),
  direction: z.enum(INTERFACE_DIRECTION_VALUES).default("OUTBOUND"),
  status: z.enum(INTERFACE_STATUS_VALUES).default("INT_ACTIVE"),
  criticality: z.enum(INTERFACE_CRITICALITY_VALUES).default("INT_MEDIUM"),
  dataFlowDescription: z.string().optional(),
  frequency: z.string().optional(),
  dataClassification: z.enum(DATA_CLASSIFICATION_VALUES).optional(),
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
          _count: { select: { interfacesFrom: true, interfacesTo: true } },
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
          replacementApp: { select: { id: true, name: true } },
          businessOwner: { select: { id: true, name: true, avatarUrl: true } },
          itOwner: { select: { id: true, name: true, avatarUrl: true } },
          interfacesFrom: {
            where: { isActive: true },
            include: { targetApp: { select: { id: true, name: true, vendor: true } } },
            orderBy: { createdAt: "desc" },
          },
          interfacesTo: {
            where: { isActive: true },
            include: { sourceApp: { select: { id: true, name: true, vendor: true } } },
            orderBy: { createdAt: "desc" },
          },
          techStackLinks: {
            include: { techRadarEntry: { select: { id: true, name: true, quadrant: true, ring: true } } },
          },
        },
      });
      if (!app) throw new TRPCError({ code: "NOT_FOUND" });
      return app;
    }),

  create: workspaceProcedure
    .input(ApplicationCreateInput)
    .mutation(async ({ ctx, input }) => {
      const { capabilityIds, lifecycleStartDate, lifecycleEndDate, annualCostUsd, costRenewalDate, actualUsers, replacementAppId, ...data } = input;

      const app = await ctx.db.application.create({
        data: {
          ...data,
          workspaceId: ctx.workspaceId,
          annualCostUsd: annualCostUsd ?? null,
          costRenewalDate: costRenewalDate ? new Date(costRenewalDate) : null,
          lifecycleStartDate: lifecycleStartDate ? new Date(lifecycleStartDate) : null,
          lifecycleEndDate: lifecycleEndDate ? new Date(lifecycleEndDate) : null,
          actualUsers: actualUsers ?? null,
          replacementAppId: replacementAppId ?? null,
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
      const { id, capabilityIds, lifecycleEndDate, annualCostUsd, costRenewalDate, actualUsers, replacementAppId, ...data } = input;

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
            ...(actualUsers !== undefined
              ? { actualUsers: actualUsers ?? null }
              : {}),
            ...(replacementAppId !== undefined
              ? { replacementAppId: replacementAppId ?? null }
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
            ...(assessData.functionalFit ? { functionalFit: assessData.functionalFit } : {}),
          },
        }),
      ]);
      return assessment;
    }),

  getRationalizationMatrix: workspaceProcedure.query(async ({ ctx }) => {
    const apps = await ctx.db.application.findMany({
      where: { workspaceId: ctx.workspaceId, isActive: true },
      include: {
        capabilities: true,
        interfacesFrom: { where: { isActive: true }, select: { id: true, criticality: true } },
        interfacesTo: { where: { isActive: true }, select: { id: true, criticality: true } },
      },
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

    // Integration density per app
    const appIntegrationCounts = apps.map((a) => ({
      id: a.id,
      name: a.name,
      inbound: a.interfacesTo.length,
      outbound: a.interfacesFrom.length,
      total: a.interfacesFrom.length + a.interfacesTo.length,
      critical: [...a.interfacesFrom, ...a.interfacesTo].filter((i) => i.criticality === "INT_CRITICAL").length,
    }));

    // Functional fit distribution
    const byFunctionalFit: Record<string, number> = {};
    // Adoption metrics
    let totalAdoption = 0;
    let adoptionCount = 0;
    // Data classification distribution
    const byDataClassification: Record<string, number> = {};

    for (const app of apps) {
      byFunctionalFit[app.functionalFit] = (byFunctionalFit[app.functionalFit] ?? 0) + 1;
      byDataClassification[app.dataClassification] = (byDataClassification[app.dataClassification] ?? 0) + 1;
      if (app.actualUsers != null && app.licensedUsers != null && app.licensedUsers > 0) {
        totalAdoption += app.actualUsers / app.licensedUsers;
        adoptionCount++;
      }
    }

    return {
      redundancies,
      retireCandidates,
      orphanedApps,
      costByStatus,
      totalApps: apps.length,
      appIntegrationCounts,
      byFunctionalFit,
      byDataClassification,
      avgAdoptionRate: adoptionCount > 0 ? totalAdoption / adoptionCount : null,
    };
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

  // ─── Interface CRUD ─────────────────────────────────────
  listInterfaces: workspaceProcedure
    .input(z.object({ appId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.applicationInterface.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
          ...(input?.appId
            ? { OR: [{ sourceAppId: input.appId }, { targetAppId: input.appId }] }
            : {}),
        },
        include: {
          sourceApp: { select: { id: true, name: true, vendor: true } },
          targetApp: { select: { id: true, name: true, vendor: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  createInterface: workspaceProcedure
    .input(InterfaceInput)
    .mutation(async ({ ctx, input }) => {
      if (input.sourceAppId === input.targetAppId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Source and target apps must be different" });
      }
      const iface = await ctx.db.applicationInterface.create({
        data: { ...input, workspaceId: ctx.workspaceId },
      });
      auditLog(ctx, { action: "CREATE", entityType: "ApplicationInterface", entityId: iface.id, after: iface as any });
      return iface;
    }),

  updateInterface: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().nullable().optional(),
        protocol: z.enum(INTERFACE_PROTOCOL_VALUES).optional(),
        direction: z.enum(INTERFACE_DIRECTION_VALUES).optional(),
        status: z.enum(INTERFACE_STATUS_VALUES).optional(),
        criticality: z.enum(INTERFACE_CRITICALITY_VALUES).optional(),
        dataFlowDescription: z.string().nullable().optional(),
        frequency: z.string().nullable().optional(),
        dataClassification: z.enum(DATA_CLASSIFICATION_VALUES).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.db.applicationInterface.findFirst({
        where: { id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.applicationInterface.update({ where: { id }, data });
    }),

  deleteInterface: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.applicationInterface.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.applicationInterface.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      auditLog(ctx, { action: "DELETE", entityType: "ApplicationInterface", entityId: input.id, before: existing as any });
      return { success: true };
    }),

  // ─── Tech Stack Links ──────────────────────────────────
  linkTech: workspaceProcedure
    .input(
      z.object({
        applicationId: z.string(),
        techRadarEntryId: z.string(),
        layer: z.enum(["APPLICATION", "MIDDLEWARE", "DATABASE", "INFRASTRUCTURE", "PLATFORM"]).default("APPLICATION"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.applicationTechLink.create({
        data: { ...input, workspaceId: ctx.workspaceId },
      });
    }),

  unlinkTech: workspaceProcedure
    .input(z.object({ applicationId: z.string(), techRadarEntryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.applicationTechLink.delete({
        where: {
          applicationId_techRadarEntryId: {
            applicationId: input.applicationId,
            techRadarEntryId: input.techRadarEntryId,
          },
        },
      });
      return { success: true };
    }),

  // ─── AI Rationalization Context (enriched) ─────────────
  getAIRationalizationContext: workspaceProcedure.query(async ({ ctx }) => {
    const [apps, workspace] = await Promise.all([
      ctx.db.application.findMany({
        where: { workspaceId: ctx.workspaceId, isActive: true },
        include: {
          capabilities: { select: { capabilityId: true, relationshipType: true } },
          interfacesFrom: {
            where: { isActive: true },
            select: { targetAppId: true, protocol: true, criticality: true, direction: true, dataClassification: true },
            include: { targetApp: { select: { name: true } } },
          },
          interfacesTo: {
            where: { isActive: true },
            select: { sourceAppId: true, protocol: true, criticality: true, direction: true, dataClassification: true },
            include: { sourceApp: { select: { name: true } } },
          },
          techStackLinks: {
            include: { techRadarEntry: { select: { name: true, quadrant: true, ring: true } } },
          },
          replacementApp: { select: { id: true, name: true } },
        },
      }),
      ctx.db.workspace.findFirst({ where: { id: ctx.workspaceId } }),
    ]);

    const enriched = apps.map((a) => {
      const adoptionRate =
        a.actualUsers != null && a.licensedUsers != null && a.licensedUsers > 0
          ? a.actualUsers / a.licensedUsers
          : null;
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        vendor: a.vendor,
        version: a.version,
        applicationType: a.applicationType,
        deploymentModel: a.deploymentModel,
        lifecycle: a.lifecycle,
        businessValue: a.businessValue,
        technicalHealth: a.technicalHealth,
        functionalFit: a.functionalFit,
        rationalizationStatus: a.rationalizationStatus,
        dataClassification: a.dataClassification,
        annualCostUsd: a.annualCostUsd ? Number(a.annualCostUsd) : null,
        costModel: a.costModel,
        licensedUsers: a.licensedUsers,
        actualUsers: a.actualUsers,
        adoptionRate,
        capabilityCount: a.capabilities.length,
        interfaceCount: {
          inbound: a.interfacesTo.length,
          outbound: a.interfacesFrom.length,
          total: a.interfacesFrom.length + a.interfacesTo.length,
          critical: [...a.interfacesFrom, ...a.interfacesTo].filter((i) => i.criticality === "INT_CRITICAL").length,
        },
        interfaces: [
          ...a.interfacesFrom.map((i) => ({
            direction: "OUTBOUND" as const,
            appName: i.targetApp.name,
            protocol: i.protocol,
            criticality: i.criticality,
            dataClassification: i.dataClassification,
          })),
          ...a.interfacesTo.map((i) => ({
            direction: "INBOUND" as const,
            appName: i.sourceApp.name,
            protocol: i.protocol,
            criticality: i.criticality,
            dataClassification: i.dataClassification,
          })),
        ],
        techStack: a.techStackLinks.map((t) => ({
          name: t.techRadarEntry.name,
          quadrant: t.techRadarEntry.quadrant,
          ring: t.techRadarEntry.ring,
          layer: t.layer,
        })),
        replacementApp: a.replacementApp?.name ?? null,
      };
    });

    return { apps: enriched, workspace };
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
        functionalFit: true,
        dataClassification: true,
        annualCostUsd: true,
      },
    });

    const byLifecycle: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byRationalization: Record<string, number> = {};
    const byHealth: Record<string, number> = {};
    const byFunctionalFit: Record<string, number> = {};
    const byDataClassification: Record<string, number> = {};
    let totalCost = 0;

    for (const app of apps) {
      byLifecycle[app.lifecycle] = (byLifecycle[app.lifecycle] ?? 0) + 1;
      byType[app.applicationType] = (byType[app.applicationType] ?? 0) + 1;
      byRationalization[app.rationalizationStatus] = (byRationalization[app.rationalizationStatus] ?? 0) + 1;
      byHealth[app.technicalHealth] = (byHealth[app.technicalHealth] ?? 0) + 1;
      byFunctionalFit[app.functionalFit] = (byFunctionalFit[app.functionalFit] ?? 0) + 1;
      byDataClassification[app.dataClassification] = (byDataClassification[app.dataClassification] ?? 0) + 1;
      totalCost += Number(app.annualCostUsd ?? 0);
    }

    return { byLifecycle, byType, byRationalization, byHealth, byFunctionalFit, byDataClassification, totalCost, totalApps: apps.length };
  }),
});
