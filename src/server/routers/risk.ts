import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";
import { computeRiskScore, eolUrgencyBand } from "@/server/services/riskScoring";

const RiskCreateInput = z.object({
  title: z.string().min(1).max(300),
  description: z.string().optional(),
  category: z.enum([
    "TECHNOLOGY_EOL", "VENDOR_RISK", "SECURITY", "ARCHITECTURE",
    "CAPABILITY_GAP", "COMPLIANCE", "OPERATIONAL", "DATA",
  ]),
  likelihood: z.enum(["RARE", "LOW", "MEDIUM", "HIGH"]),
  impact: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  status: z.enum(["OPEN", "IN_PROGRESS", "MITIGATED", "ACCEPTED", "CLOSED"]).default("OPEN"),
  ownerId: z.string().optional(),
  dueDate: z.string().optional(),
  applicationIds: z.array(z.string()).optional(),
  capabilityIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
});

const RiskUpdateInput = z.object({
  id: z.string(),
  title: z.string().min(1).max(300).optional(),
  description: z.string().nullable().optional(),
  category: z.enum([
    "TECHNOLOGY_EOL", "VENDOR_RISK", "SECURITY", "ARCHITECTURE",
    "CAPABILITY_GAP", "COMPLIANCE", "OPERATIONAL", "DATA",
  ]).optional(),
  likelihood: z.enum(["RARE", "LOW", "MEDIUM", "HIGH"]).optional(),
  impact: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "MITIGATED", "ACCEPTED", "CLOSED"]).optional(),
  ownerId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  applicationIds: z.array(z.string()).optional(),
  capabilityIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
});

export const riskRouter = router({
  list: workspaceProcedure
    .input(
      z.object({
        status: z.enum(["OPEN", "IN_PROGRESS", "MITIGATED", "ACCEPTED", "CLOSED"]).optional(),
        category: z.enum([
          "TECHNOLOGY_EOL", "VENDOR_RISK", "SECURITY", "ARCHITECTURE",
          "CAPABILITY_GAP", "COMPLIANCE", "OPERATIONAL", "DATA",
        ]).optional(),
        minScore: z.number().int().min(1).max(16).optional(),
        applicationId: z.string().optional(),
        capabilityId: z.string().optional(),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.techRisk.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.category ? { category: input.category } : {}),
          ...(input?.minScore ? { riskScore: { gte: input.minScore } } : {}),
          ...(input?.applicationId
            ? { applicationLinks: { some: { applicationId: input.applicationId } } }
            : {}),
          ...(input?.capabilityId
            ? { capabilityLinks: { some: { capabilityId: input.capabilityId } } }
            : {}),
          ...(input?.search
            ? { title: { contains: input.search, mode: "insensitive" } }
            : {}),
        },
        include: {
          applicationLinks: true,
          capabilityLinks: true,
          remediations: true,
          tags: { include: { tag: true } },
          owner: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: [{ riskScore: "desc" }, { identifiedAt: "desc" }],
      });
    }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const risk = await ctx.db.techRisk.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: {
          applicationLinks: true,
          capabilityLinks: true,
          remediations: true,
          tags: { include: { tag: true } },
          owner: true,
        },
      });
      if (!risk) throw new TRPCError({ code: "NOT_FOUND" });
      return risk;
    }),

  create: workspaceProcedure
    .input(RiskCreateInput)
    .mutation(async ({ ctx, input }) => {
      const { applicationIds, capabilityIds, tagIds, dueDate, ...data } = input;
      const riskScore = computeRiskScore(data.likelihood, data.impact);

      const risk = await ctx.db.techRisk.create({
        data: {
          ...data,
          workspaceId: ctx.workspaceId,
          riskScore,
          dueDate: dueDate ? new Date(dueDate) : null,
          applicationLinks: applicationIds?.length
            ? {
                create: applicationIds.map((applicationId) => ({
                  applicationId,
                  workspaceId: ctx.workspaceId,
                })),
              }
            : undefined,
          capabilityLinks: capabilityIds?.length
            ? {
                create: capabilityIds.map((capabilityId) => ({
                  capabilityId,
                  workspaceId: ctx.workspaceId,
                })),
              }
            : undefined,
          tags: tagIds?.length
            ? { create: tagIds.map((tagId) => ({ tagId })) }
            : undefined,
        },
      });

      auditLog(ctx, {
        action: "CREATE",
        entityType: "TechRisk",
        entityId: risk.id,
        after: risk as unknown as Record<string, unknown>,
      });
      return risk;
    }),

  update: workspaceProcedure
    .input(RiskUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.techRisk.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, applicationIds, capabilityIds, tagIds, dueDate, likelihood, impact, ...data } = input;
      const newLikelihood = likelihood ?? existing.likelihood;
      const newImpact = impact ?? existing.impact;
      const riskScore = computeRiskScore(newLikelihood, newImpact);

      const updated = await ctx.db.$transaction(async (tx) => {
        if (applicationIds !== undefined) {
          await tx.riskApplicationLink.deleteMany({ where: { riskId: id } });
          if (applicationIds.length > 0) {
            await tx.riskApplicationLink.createMany({
              data: applicationIds.map((applicationId) => ({
                riskId: id,
                applicationId,
                workspaceId: ctx.workspaceId,
              })),
            });
          }
        }
        if (capabilityIds !== undefined) {
          await tx.riskCapabilityLink.deleteMany({ where: { riskId: id } });
          if (capabilityIds.length > 0) {
            await tx.riskCapabilityLink.createMany({
              data: capabilityIds.map((capabilityId) => ({
                riskId: id,
                capabilityId,
                workspaceId: ctx.workspaceId,
              })),
            });
          }
        }
        if (tagIds !== undefined) {
          await tx.riskTagMap.deleteMany({ where: { riskId: id } });
          if (tagIds.length > 0) {
            await tx.riskTagMap.createMany({
              data: tagIds.map((tagId) => ({ riskId: id, tagId })),
            });
          }
        }
        return tx.techRisk.update({
          where: { id },
          data: {
            ...data,
            ...(likelihood ? { likelihood } : {}),
            ...(impact ? { impact } : {}),
            riskScore,
            ...(dueDate !== undefined
              ? { dueDate: dueDate ? new Date(dueDate) : null }
              : {}),
          },
        });
      });

      auditLog(ctx, {
        action: "UPDATE",
        entityType: "TechRisk",
        entityId: id,
        before: existing as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  accept: workspaceProcedure
    .input(z.object({ id: z.string(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.techRisk.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.techRisk.update({
        where: { id: input.id },
        data: { status: "ACCEPTED" },
      });

      auditLog(ctx, {
        action: "UPDATE",
        entityType: "TechRisk",
        entityId: input.id,
        before: { status: existing.status } as Record<string, unknown>,
        after: { status: "ACCEPTED" } as Record<string, unknown>,
      });
      return updated;
    }),

  linkRemediation: workspaceProcedure
    .input(
      z.object({
        riskId: z.string(),
        remediationType: z.enum(["INITIATIVE_LINK", "MANUAL_ACTION", "ACCEPTED_RISK", "DEFERRED"]),
        initiativeId: z.string().optional(),
        description: z.string().optional(),
        targetDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const risk = await ctx.db.techRisk.findFirst({
        where: { id: input.riskId, workspaceId: ctx.workspaceId },
      });
      if (!risk) throw new TRPCError({ code: "NOT_FOUND" });

      const remediation = await ctx.db.riskRemediation.create({
        data: {
          riskId: input.riskId,
          workspaceId: ctx.workspaceId,
          remediationType: input.remediationType,
          initiativeId: input.initiativeId ?? null,
          description: input.description ?? null,
          targetDate: input.targetDate ? new Date(input.targetDate) : null,
        },
      });

      // Advance risk to IN_PROGRESS if still OPEN
      if (risk.status === "OPEN") {
        await ctx.db.techRisk.update({
          where: { id: input.riskId },
          data: { status: "IN_PROGRESS" },
        });
      }

      auditLog(ctx, {
        action: "UPDATE",
        entityType: "TechRisk",
        entityId: input.riskId,
        after: { linkedRemediation: remediation.id } as Record<string, unknown>,
      });
      return remediation;
    }),

  deleteRemediation: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const remediation = await ctx.db.riskRemediation.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!remediation) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.riskRemediation.delete({ where: { id: input.id } });

      auditLog(ctx, {
        action: "DELETE",
        entityType: "RiskRemediation",
        entityId: input.id,
        before: remediation as unknown as Record<string, unknown>,
      });
      return { success: true };
    }),

  getStats: workspaceProcedure.query(async ({ ctx }) => {
    const risks = await ctx.db.techRisk.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { status: true, category: true, riskScore: true },
    });

    const total = risks.length;
    const open = risks.filter((r) => r.status === "OPEN").length;
    const inProgress = risks.filter((r) => r.status === "IN_PROGRESS").length;
    const critical = risks.filter((r) => r.riskScore >= 12).length;
    const unmitigated = risks.filter(
      (r) => r.status === "OPEN" || r.status === "IN_PROGRESS"
    ).length;

    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    for (const r of risks) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    }

    return { total, open, inProgress, critical, unmitigated, byStatus, byCategory };
  }),

  runAutoScan: workspaceProcedure.mutation(async ({ ctx }) => {
    const now = new Date();
    const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const created: string[] = [];

    // EOL risks — apps with lifecycleEndDate within 90 days
    const eolApps = await ctx.db.application.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        isActive: true,
        lifecycleEndDate: { lte: ninetyDaysOut },
      },
      include: { _count: { select: { capabilities: true } } },
    });

    for (const app of eolApps) {
      const daysUntil = Math.ceil(
        ((app.lifecycleEndDate?.getTime() ?? 0) - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const likelihood = daysUntil < 30 ? "HIGH" : "MEDIUM";
      const impact =
        app._count.capabilities > 10
          ? "CRITICAL"
          : app._count.capabilities > 3
          ? "HIGH"
          : "MEDIUM";
      const riskScore = computeRiskScore(likelihood, impact);
      const sourceEntityId = app.id;

      const existing = await ctx.db.techRisk.findFirst({
        where: { workspaceId: ctx.workspaceId, sourceEntityId, sourceType: "EOL_SCAN" },
      });

      if (!existing) {
        const risk = await ctx.db.techRisk.create({
          data: {
            workspaceId: ctx.workspaceId,
            title: `EOL Risk: ${app.name}`,
            description: `${app.name} reaches end-of-life on ${app.lifecycleEndDate?.toLocaleDateString()}. ${app._count.capabilities} capability mappings at risk.`,
            category: "TECHNOLOGY_EOL",
            likelihood,
            impact,
            riskScore,
            isAutoGenerated: true,
            sourceType: "EOL_SCAN",
            sourceEntityId,
            applicationLinks: {
              create: [{ applicationId: app.id, workspaceId: ctx.workspaceId }],
            },
          },
        });
        created.push(risk.id);
      }
    }

    // Capability gap risks — CRITICAL capabilities with no app mappings
    const criticalCaps = await ctx.db.businessCapability.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        isActive: true,
        strategicImportance: "CRITICAL",
      },
      include: { _count: { select: { applicationMappings: true } } },
    });

    for (const cap of criticalCaps) {
      if (cap._count.applicationMappings > 0) continue;
      const sourceEntityId = cap.id;

      const existing = await ctx.db.techRisk.findFirst({
        where: { workspaceId: ctx.workspaceId, sourceEntityId, sourceType: "CAPABILITY_GAP" },
      });

      if (!existing) {
        const riskScore = computeRiskScore("MEDIUM", "HIGH");
        const risk = await ctx.db.techRisk.create({
          data: {
            workspaceId: ctx.workspaceId,
            title: `Capability Gap: ${cap.name}`,
            description: `Critical capability "${cap.name}" has no applications mapped. This represents an architecture gap with no IT support.`,
            category: "CAPABILITY_GAP",
            likelihood: "MEDIUM",
            impact: "HIGH",
            riskScore,
            isAutoGenerated: true,
            sourceType: "CAPABILITY_GAP",
            sourceEntityId,
            capabilityLinks: {
              create: [{ capabilityId: cap.id, workspaceId: ctx.workspaceId }],
            },
          },
        });
        created.push(risk.id);
      }
    }

    return { created: created.length, ids: created };
  }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.techRisk.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.techRisk.delete({ where: { id: input.id } });

      auditLog(ctx, {
        action: "DELETE",
        entityType: "TechRisk",
        entityId: input.id,
        before: existing as unknown as Record<string, unknown>,
      });
      return { success: true };
    }),
});
