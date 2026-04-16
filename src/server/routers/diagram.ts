import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";

const SCENARIO_VALUES = ["AS_IS", "TO_BE"] as const;
const REVIEW_STATUS_VALUES = ["PENDING", "ACCEPTED", "REJECTED"] as const;

const NodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const NodeSizeSchema = z.object({
  w: z.number().min(60).max(1200),
  h: z.number().min(40).max(800),
});

const ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

export const diagramRouter = router({
  // ─── Layout ─────────────────────────────────────────────
  getLayout: workspaceProcedure
    .input(z.object({ scenario: z.enum(SCENARIO_VALUES).default("AS_IS") }))
    .query(async ({ ctx, input }) => {
      const layout = await ctx.db.diagramLayout.findUnique({
        where: {
          workspaceId_scenario: {
            workspaceId: ctx.workspaceId,
            scenario: input.scenario,
          },
        },
      });
      return layout;
    }),

  saveLayout: workspaceProcedure
    .input(
      z.object({
        scenario: z.enum(SCENARIO_VALUES).default("AS_IS"),
        nodePositions: z.record(z.string(), NodePositionSchema).optional(),
        nodeSizes: z.record(z.string(), NodeSizeSchema).optional(),
        defaultNodeW: z.number().min(60).max(1200).nullable().optional(),
        defaultNodeH: z.number().min(40).max(800).nullable().optional(),
        viewport: ViewportSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = {
        updatedById: ctx.dbUserId,
      };
      if (input.nodePositions !== undefined) updateData.nodePositions = input.nodePositions;
      if (input.nodeSizes !== undefined) updateData.nodeSizes = input.nodeSizes;
      if (input.defaultNodeW !== undefined) updateData.defaultNodeW = input.defaultNodeW;
      if (input.defaultNodeH !== undefined) updateData.defaultNodeH = input.defaultNodeH;
      if (input.viewport !== undefined) updateData.viewport = input.viewport;

      return ctx.db.diagramLayout.upsert({
        where: {
          workspaceId_scenario: {
            workspaceId: ctx.workspaceId,
            scenario: input.scenario,
          },
        },
        create: {
          workspaceId: ctx.workspaceId,
          scenario: input.scenario,
          nodePositions: (input.nodePositions ?? {}) as object,
          nodeSizes: (input.nodeSizes ?? {}) as object,
          defaultNodeW: input.defaultNodeW ?? null,
          defaultNodeH: input.defaultNodeH ?? null,
          viewport: input.viewport as object | undefined,
          updatedById: ctx.dbUserId,
        },
        update: updateData,
      });
    }),

  // ─── Interfaces for the diagram ─────────────────────────
  // Returns the shape the canvas needs in ONE round-trip:
  // applications + interfaces (filtered by scenario + reviewStatus).
  getDiagramData: workspaceProcedure
    .input(
      z.object({
        scenario: z.enum(SCENARIO_VALUES).default("AS_IS"),
        reviewStatus: z.enum(REVIEW_STATUS_VALUES).optional(),
        includeDataFlows: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const [apps, interfaces, layout] = await Promise.all([
        ctx.db.application.findMany({
          where: { workspaceId: ctx.workspaceId, isActive: true },
          select: {
            id: true,
            name: true,
            vendor: true,
            applicationType: true,
            lifecycle: true,
            businessValue: true,
            technicalHealth: true,
            rationalizationStatus: true,
            systemLandscapeRole: true,
          },
          orderBy: { name: "asc" },
        }),
        ctx.db.applicationInterface.findMany({
          where: {
            workspaceId: ctx.workspaceId,
            isActive: true,
            scenario: input.scenario,
            ...(input.reviewStatus ? { reviewStatus: input.reviewStatus } : {}),
          },
          include: {
            sourceApp: { select: { id: true, name: true } },
            targetApp: { select: { id: true, name: true } },
            ...(input.includeDataFlows
              ? {
                  dataFlows: {
                    include: {
                      entity: {
                        select: { id: true, name: true, domainId: true },
                      },
                    },
                  },
                }
              : {}),
          },
          orderBy: { createdAt: "desc" },
        }),
        ctx.db.diagramLayout.findUnique({
          where: {
            workspaceId_scenario: {
              workspaceId: ctx.workspaceId,
              scenario: input.scenario,
            },
          },
        }),
      ]);

      return { apps, interfaces, layout };
    }),

  // ─── Review queue for AI-suggested interfaces ───────────
  listPendingSuggestions: workspaceProcedure
    .input(z.object({ scenario: z.enum(SCENARIO_VALUES).default("AS_IS") }))
    .query(async ({ ctx, input }) => {
      return ctx.db.applicationInterface.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
          scenario: input.scenario,
          reviewStatus: "PENDING",
        },
        include: {
          sourceApp: { select: { id: true, name: true } },
          targetApp: { select: { id: true, name: true } },
        },
        orderBy: [{ aiConfidence: "desc" }, { createdAt: "desc" }],
      });
    }),

  acceptSuggestion: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.applicationInterface.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.applicationInterface.update({
        where: { id: input.id },
        data: {
          reviewStatus: "ACCEPTED",
          source: existing.source === "AI_SUGGESTED" ? "AI_ACCEPTED" : existing.source,
        },
      });
      auditLog(ctx, {
        action: "UPDATE",
        entityType: "ApplicationInterface",
        entityId: updated.id,
        after: { reviewStatus: "ACCEPTED" } as Record<string, unknown>,
      });
      return updated;
    }),

  rejectSuggestion: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.applicationInterface.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      // Keep the row so AI regeneration remembers not to re-propose it.
      const updated = await ctx.db.applicationInterface.update({
        where: { id: input.id },
        data: { reviewStatus: "REJECTED" },
      });
      auditLog(ctx, {
        action: "UPDATE",
        entityType: "ApplicationInterface",
        entityId: updated.id,
        after: { reviewStatus: "REJECTED" } as Record<string, unknown>,
      });
      return updated;
    }),

  bulkAcceptByConfidence: workspaceProcedure
    .input(
      z.object({
        scenario: z.enum(SCENARIO_VALUES).default("AS_IS"),
        minConfidence: z.number().int().min(0).max(100).default(80),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.applicationInterface.updateMany({
        where: {
          workspaceId: ctx.workspaceId,
          scenario: input.scenario,
          reviewStatus: "PENDING",
          source: "AI_SUGGESTED",
          aiConfidence: { gte: input.minConfidence },
        },
        data: { reviewStatus: "ACCEPTED", source: "AI_ACCEPTED" },
      });
      return { accepted: result.count };
    }),

  // ─── AI Run history ─────────────────────────────────────
  listAiRuns: workspaceProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.aIArchitectureRun.findMany({
        where: { workspaceId: ctx.workspaceId },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 10,
      });
    }),
});
