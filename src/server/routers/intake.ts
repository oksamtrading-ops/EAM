import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";
import type { IntakeEntityType } from "@/generated/prisma/client";

const DraftStatusEnum = z.enum(["PENDING", "ACCEPTED", "REJECTED", "MODIFIED"]);
const EntityTypeEnum = z.enum([
  "CAPABILITY",
  "APPLICATION",
  "RISK",
  "VENDOR",
  "TECH_COMPONENT",
  "INITIATIVE",
]);

const PayloadOverrides = z.record(z.string(), z.unknown()).optional();

export const intakeRouter = router({
  listDocuments: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db.intakeDocument.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
        errorMessage: true,
        uploadedAt: true,
        _count: { select: { drafts: true } },
      },
    });
  }),

  getDocument: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const doc = await ctx.db.intakeDocument.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: {
          drafts: { orderBy: [{ confidence: "desc" }, { createdAt: "asc" }] },
        },
      });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      return doc;
    }),

  listDrafts: workspaceProcedure
    .input(
      z
        .object({
          status: DraftStatusEnum.optional(),
          entityType: EntityTypeEnum.optional(),
          documentId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.intakeDraft.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          status: input?.status,
          entityType: input?.entityType,
          documentId: input?.documentId,
        },
        orderBy: [
          { status: "asc" },
          { confidence: "desc" },
          { createdAt: "asc" },
        ],
        include: {
          document: { select: { id: true, filename: true } },
        },
      });
    }),

  acceptDraft: workspaceProcedure
    .input(
      z.object({ id: z.string(), overrides: PayloadOverrides })
    )
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.intakeDraft.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.status !== "PENDING" && draft.status !== "MODIFIED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Draft already ${draft.status}`,
        });
      }

      const payload = {
        ...(draft.payload as Record<string, unknown>),
        ...(input.overrides ?? {}),
      };

      const committed = await commitDraft(
        ctx,
        draft.entityType,
        payload
      );

      const updated = await ctx.db.intakeDraft.update({
        where: { id: input.id },
        data: {
          status: "ACCEPTED",
          reviewedBy: ctx.dbUserId,
          reviewedAt: new Date(),
          committedEntityId: committed.id,
          payload: JSON.parse(JSON.stringify(payload)),
        },
      });

      auditLog(ctx, {
        action: "CREATE",
        entityType: `Intake:${draft.entityType}`,
        entityId: committed.id,
        after: { draftId: draft.id, payload } as never,
      });

      return { draft: updated, committedEntityId: committed.id };
    }),

  rejectDraft: workspaceProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.intakeDraft.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.intakeDraft.update({
        where: { id: input.id },
        data: {
          status: "REJECTED",
          reviewedBy: ctx.dbUserId,
          reviewedAt: new Date(),
          rejectionReason: input.reason ?? null,
        },
      });
    }),

  modifyDraft: workspaceProcedure
    .input(z.object({ id: z.string(), payload: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.intakeDraft.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.status === "ACCEPTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot modify an accepted draft",
        });
      }

      return ctx.db.intakeDraft.update({
        where: { id: input.id },
        data: {
          status: "MODIFIED",
          payload: JSON.parse(JSON.stringify(input.payload)),
        },
      });
    }),

  proposeInitiative: workspaceProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        category: z.string().optional(),
        priority: z.string().optional(),
        horizon: z.string().optional(),
        rationale: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const confidence =
        typeof input.confidence === "number" ? input.confidence : 0.75;
      return ctx.db.intakeDraft.create({
        data: {
          workspaceId: ctx.workspaceId,
          entityType: "INITIATIVE",
          confidence,
          status: "PENDING",
          payload: JSON.parse(
            JSON.stringify({
              name: input.name,
              description: input.description,
              category: input.category,
              priority: input.priority,
              horizon: input.horizon,
              sourceType: "AI_AGENT",
              sourceContext: input.rationale ?? null,
            })
          ),
          evidence: JSON.parse(
            JSON.stringify(
              input.rationale
                ? [
                    {
                      excerpt: input.rationale.slice(0, 600),
                      source: "agent_proposal",
                    },
                  ]
                : []
            )
          ),
        },
        select: { id: true, entityType: true, status: true },
      });
    }),

  bulkAcceptByConfidence: workspaceProcedure
    .input(z.object({ threshold: z.number().min(0).max(1) }))
    .mutation(async ({ ctx, input }) => {
      const drafts = await ctx.db.intakeDraft.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          status: { in: ["PENDING", "MODIFIED"] },
          confidence: { gte: input.threshold },
        },
      });

      let accepted = 0;
      let failed = 0;
      for (const draft of drafts) {
        try {
          const committed = await commitDraft(
            ctx,
            draft.entityType,
            draft.payload as Record<string, unknown>
          );
          await ctx.db.intakeDraft.update({
            where: { id: draft.id },
            data: {
              status: "ACCEPTED",
              reviewedBy: ctx.dbUserId,
              reviewedAt: new Date(),
              committedEntityId: committed.id,
            },
          });
          accepted++;
        } catch {
          failed++;
        }
      }
      return { accepted, failed };
    }),
});

type Ctx = {
  db: typeof import("@/server/db").db;
  workspaceId: string;
  dbUserId: string;
};

async function commitDraft(
  ctx: Ctx,
  entityType: IntakeEntityType,
  payload: Record<string, unknown>
): Promise<{ id: string }> {
  switch (entityType) {
    case "CAPABILITY": {
      const name = String(payload.name ?? "").trim();
      if (!name)
        throw new TRPCError({ code: "BAD_REQUEST", message: "name required" });
      const level = asLevel(payload.level);
      const parentName = stringOrNull(payload.parentName);
      let parentId: string | null = null;
      if (level !== "L1" && parentName) {
        const parent = await ctx.db.businessCapability.findFirst({
          where: {
            workspaceId: ctx.workspaceId,
            name: { equals: parentName, mode: "insensitive" },
            isActive: true,
          },
          select: { id: true, level: true },
        });
        if (!parent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Parent capability "${parentName}" not found. Create it first or edit the draft to match an existing capability.`,
          });
        }
        parentId = parent.id;
      }
      return ctx.db.businessCapability.create({
        data: {
          workspaceId: ctx.workspaceId,
          name,
          description: stringOrNull(payload.description),
          level,
          parentId,
        },
        select: { id: true },
      });
    }
    case "APPLICATION": {
      const name = String(payload.name ?? "").trim();
      if (!name)
        throw new TRPCError({ code: "BAD_REQUEST", message: "name required" });
      return ctx.db.application.create({
        data: {
          workspaceId: ctx.workspaceId,
          name,
          description: stringOrNull(payload.description),
          vendor: stringOrNull(payload.vendor),
          applicationType: asAppType(payload.applicationType),
          lifecycle: asLifecycle(payload.lifecycle),
        },
        select: { id: true },
      });
    }
    case "RISK": {
      const title = String(payload.title ?? payload.name ?? "").trim();
      if (!title)
        throw new TRPCError({ code: "BAD_REQUEST", message: "title required" });
      const category = asRiskCategory(payload.category);
      const likelihood = asRiskLikelihood(payload.likelihood);
      const impact = asRiskImpact(payload.impact);
      return ctx.db.techRisk.create({
        data: {
          workspaceId: ctx.workspaceId,
          title,
          description: stringOrNull(payload.description),
          category,
          likelihood,
          impact,
          riskScore: riskScoreFor(likelihood, impact),
          isAutoGenerated: true,
          sourceType: "INTAKE",
        },
        select: { id: true },
      });
    }
    case "VENDOR": {
      const name = String(payload.name ?? "").trim();
      if (!name)
        throw new TRPCError({ code: "BAD_REQUEST", message: "name required" });
      return ctx.db.vendor.create({
        data: {
          workspaceId: ctx.workspaceId,
          name,
          description: stringOrNull(payload.description),
        },
        select: { id: true },
      });
    }
    case "TECH_COMPONENT":
      // Technology components require linked Vendor + TechnologyProduct
      // records, which we can't safely infer from an unstructured doc.
      // Surface the draft so users see what was extracted, but direct
      // them to create it via the Tech Architecture page.
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Accept tech-component drafts from the Tech Architecture page (vendor + product must be chosen).",
      });
    case "INITIATIVE": {
      const name = String(payload.name ?? "").trim();
      if (!name)
        throw new TRPCError({ code: "BAD_REQUEST", message: "name required" });
      return ctx.db.initiative.create({
        data: {
          workspaceId: ctx.workspaceId,
          name,
          description: stringOrNull(payload.description),
          category: asInitiativeCategory(payload.category),
          priority: asInitiativePriority(payload.priority),
          horizon: asInitiativeHorizon(payload.horizon),
          status: "DRAFT",
          sourceType: stringOrNull(payload.sourceType) ?? "AI_AGENT",
          sourceContext: stringOrNull(payload.sourceContext),
        },
        select: { id: true },
      });
    }
    default:
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Unsupported entityType: ${entityType}`,
      });
  }
}

function stringOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function asLevel(v: unknown): "L1" | "L2" | "L3" {
  const s = String(v ?? "").toUpperCase();
  return s === "L1" || s === "L2" || s === "L3" ? s : "L2";
}

function asAppType(
  v: unknown
): "SAAS" | "COTS" | "CUSTOM" | "PAAS" | "OPEN_SOURCE" | "LEGACY" {
  const s = String(v ?? "").toUpperCase();
  const allowed = ["SAAS", "COTS", "CUSTOM", "PAAS", "OPEN_SOURCE", "LEGACY"];
  return (allowed.includes(s) ? s : "CUSTOM") as never;
}

function asLifecycle(
  v: unknown
): "PLANNED" | "ACTIVE" | "PHASING_OUT" | "RETIRED" | "SUNSET" {
  const s = String(v ?? "").toUpperCase();
  const allowed = ["PLANNED", "ACTIVE", "PHASING_OUT", "RETIRED", "SUNSET"];
  return (allowed.includes(s) ? s : "ACTIVE") as never;
}

function asRiskCategory(
  v: unknown
):
  | "TECHNOLOGY_EOL"
  | "VENDOR_RISK"
  | "SECURITY"
  | "ARCHITECTURE"
  | "CAPABILITY_GAP"
  | "COMPLIANCE"
  | "OPERATIONAL"
  | "DATA" {
  const s = String(v ?? "").toUpperCase().replace(/\s+/g, "_");
  const allowed = [
    "TECHNOLOGY_EOL",
    "VENDOR_RISK",
    "SECURITY",
    "ARCHITECTURE",
    "CAPABILITY_GAP",
    "COMPLIANCE",
    "OPERATIONAL",
    "DATA",
  ];
  return (allowed.includes(s) ? s : "OPERATIONAL") as never;
}

function asRiskLikelihood(v: unknown): "RARE" | "LOW" | "MEDIUM" | "HIGH" {
  const s = String(v ?? "").toUpperCase();
  const allowed = ["RARE", "LOW", "MEDIUM", "HIGH"];
  return (allowed.includes(s) ? s : "MEDIUM") as never;
}

function asRiskImpact(v: unknown): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const s = String(v ?? "").toUpperCase();
  const allowed = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  return (allowed.includes(s) ? s : "MEDIUM") as never;
}

function riskScoreFor(
  likelihood: "RARE" | "LOW" | "MEDIUM" | "HIGH",
  impact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
): number {
  const L: Record<string, number> = { RARE: 1, LOW: 2, MEDIUM: 3, HIGH: 4 };
  const I: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  return (L[likelihood] ?? 3) * (I[impact] ?? 2);
}

function asInitiativeCategory(
  v: unknown
):
  | "MODERNISATION"
  | "CONSOLIDATION"
  | "DIGITALISATION"
  | "COMPLIANCE"
  | "OPTIMISATION"
  | "INNOVATION"
  | "DECOMMISSION" {
  const s = String(v ?? "").toUpperCase().replace(/\s+/g, "_");
  const allowed = [
    "MODERNISATION",
    "CONSOLIDATION",
    "DIGITALISATION",
    "COMPLIANCE",
    "OPTIMISATION",
    "INNOVATION",
    "DECOMMISSION",
  ];
  return (allowed.includes(s) ? s : "MODERNISATION") as never;
}

function asInitiativePriority(
  v: unknown
): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  const s = String(v ?? "").toUpperCase();
  const allowed = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  return (allowed.includes(s) ? s : "MEDIUM") as never;
}

function asInitiativeHorizon(
  v: unknown
): "H1_NOW" | "H2_NEXT" | "H3_LATER" | "BEYOND" {
  const s = String(v ?? "").toUpperCase();
  const allowed = ["H1_NOW", "H2_NEXT", "H3_LATER", "BEYOND"];
  return (allowed.includes(s) ? s : "H2_NEXT") as never;
}
