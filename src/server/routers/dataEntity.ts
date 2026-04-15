import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";
import { computeDataFindings } from "@/server/services/dataFindings";

const ENTITY_TYPES = ["MASTER", "REFERENCE", "TRANSACTIONAL", "ANALYTICAL", "METADATA"] as const;
const CLASSIFICATIONS = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "DC_UNKNOWN"] as const;
const REG_TAGS = ["PII", "PHI", "PCI", "GDPR", "CCPA", "SOX", "HIPAA", "FERPA"] as const;
const DQ_DIMENSIONS = [
  "COMPLETENESS", "ACCURACY", "CONSISTENCY", "TIMELINESS", "UNIQUENESS", "VALIDITY",
] as const;

const EntityCreateInput = z.object({
  domainId: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  entityType: z.enum(ENTITY_TYPES).default("TRANSACTIONAL"),
  classification: z.enum(CLASSIFICATIONS).default("DC_UNKNOWN"),
  regulatoryTags: z.array(z.enum(REG_TAGS)).optional(),
  goldenSourceAppId: z.string().optional(),
  retentionDays: z.number().int().positive().optional(),
  stewardId: z.string().optional(),
  businessOwnerId: z.string().optional(),
  custodianId: z.string().optional(),
});

const EntityUpdateInput = z.object({
  id: z.string(),
  domainId: z.string().optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  entityType: z.enum(ENTITY_TYPES).optional(),
  classification: z.enum(CLASSIFICATIONS).optional(),
  regulatoryTags: z.array(z.enum(REG_TAGS)).optional(),
  goldenSourceAppId: z.string().nullable().optional(),
  retentionDays: z.number().int().positive().nullable().optional(),
  stewardId: z.string().nullable().optional(),
  businessOwnerId: z.string().nullable().optional(),
  custodianId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const dataEntityRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({
          domainId: z.string().optional(),
          entityType: z.enum(ENTITY_TYPES).optional(),
          classification: z.enum(CLASSIFICATIONS).optional(),
          regulatoryTag: z.enum(REG_TAGS).optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.dataEntity.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
          ...(input?.domainId ? { domainId: input.domainId } : {}),
          ...(input?.entityType ? { entityType: input.entityType } : {}),
          ...(input?.classification ? { classification: input.classification } : {}),
          ...(input?.regulatoryTag ? { regulatoryTags: { has: input.regulatoryTag } } : {}),
          ...(input?.search
            ? { name: { contains: input.search, mode: "insensitive" } }
            : {}),
        },
        include: {
          domain: { select: { id: true, name: true, color: true } },
          goldenSourceApp: { select: { id: true, name: true } },
          steward: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: { select: { appUsages: true } },
        },
        orderBy: [{ name: "asc" }],
      });
    }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const entity = await ctx.db.dataEntity.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: {
          domain: true,
          goldenSourceApp: true,
          steward: true,
          businessOwner: true,
          custodian: true,
          appUsages: {
            include: {
              app: { select: { id: true, name: true, lifecycle: true } },
            },
          },
          qualityScores: { orderBy: { asOf: "desc" } },
        },
      });
      if (!entity) throw new TRPCError({ code: "NOT_FOUND" });
      return entity;
    }),

  create: workspaceProcedure
    .input(EntityCreateInput)
    .mutation(async ({ ctx, input }) => {
      // Verify domain belongs to workspace
      const domain = await ctx.db.dataDomain.findFirst({
        where: { id: input.domainId, workspaceId: ctx.workspaceId },
      });
      if (!domain) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid domain" });

      const entity = await ctx.db.dataEntity.create({
        data: {
          ...input,
          regulatoryTags: input.regulatoryTags ?? [],
          workspaceId: ctx.workspaceId,
        },
      });
      auditLog(ctx, {
        action: "CREATE",
        entityType: "DataEntity",
        entityId: entity.id,
        after: entity as unknown as Record<string, unknown>,
      });
      return entity;
    }),

  update: workspaceProcedure
    .input(EntityUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.dataEntity.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, ...data } = input;
      const updated = await ctx.db.dataEntity.update({
        where: { id },
        data,
      });
      auditLog(ctx, {
        action: "UPDATE",
        entityType: "DataEntity",
        entityId: id,
        before: existing as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.dataEntity.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.dataEntity.delete({ where: { id: input.id } });
      auditLog(ctx, {
        action: "DELETE",
        entityType: "DataEntity",
        entityId: input.id,
        before: existing as unknown as Record<string, unknown>,
      });
      return { success: true };
    }),

  recordQualityScore: workspaceProcedure
    .input(
      z.object({
        entityId: z.string(),
        dimension: z.enum(DQ_DIMENSIONS),
        score: z.number().int().min(0).max(100),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const entity = await ctx.db.dataEntity.findFirst({
        where: { id: input.entityId, workspaceId: ctx.workspaceId },
      });
      if (!entity) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.dataQualityScore.create({
        data: {
          entityId: input.entityId,
          dimension: input.dimension,
          score: input.score,
          note: input.note,
        },
      });
    }),

  stats: workspaceProcedure.query(async ({ ctx }) => {
    const entities = await ctx.db.dataEntity.findMany({
      where: { workspaceId: ctx.workspaceId, isActive: true },
      select: {
        id: true,
        classification: true,
        entityType: true,
        regulatoryTags: true,
        stewardId: true,
        businessOwnerId: true,
        custodianId: true,
        goldenSourceAppId: true,
      },
    });

    const total = entities.length;
    const withoutSteward = entities.filter((e) => !e.stewardId).length;
    const withoutBusinessOwner = entities.filter((e) => !e.businessOwnerId).length;
    const withoutCustodian = entities.filter((e) => !e.custodianId).length;
    const withoutGoldenSource = entities.filter((e) => !e.goldenSourceAppId).length;
    const unclassified = entities.filter((e) => e.classification === "DC_UNKNOWN").length;
    const sensitive = entities.filter(
      (e) => e.classification === "CONFIDENTIAL" || e.classification === "RESTRICTED"
    ).length;

    const byClassification: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const e of entities) {
      byClassification[e.classification] = (byClassification[e.classification] ?? 0) + 1;
      byType[e.entityType] = (byType[e.entityType] ?? 0) + 1;
    }

    return {
      total,
      withoutSteward,
      withoutBusinessOwner,
      withoutCustodian,
      withoutGoldenSource,
      unclassified,
      sensitive,
      byClassification,
      byType,
    };
  }),

  /**
   * Single source of truth for "governance gaps" across the data catalog.
   * Used by Risk auto-scan (to emit DATA_* findings) AND the Dashboard
   * DataKpiStrip. Backed by {@link computeDataFindings}.
   */
  autoScanFindings: workspaceProcedure.query(async ({ ctx }) => {
    return computeDataFindings(ctx.db, ctx.workspaceId);
  }),
});
