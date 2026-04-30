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
  "OBJECTIVE",
  "COMPLIANCE_REQUIREMENT",
  "EOL_WATCH",
  "ARCH_STATE",
  "WORKSPACE_PROFILE",
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
        _count: {
          select: { drafts: true, chunks: true, knowledgeDrafts: true },
        },
      },
    });
  }),

  deleteDocument: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.intakeDocument.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        select: { id: true },
      });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      // IntakeChunk cascades; IntakeDraft + KnowledgeDraft have
      // onDelete: SetNull, so their rows survive with a null source.
      await ctx.db.intakeDocument.delete({ where: { id: doc.id } });
      return { success: true };
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
      const drafts = await ctx.db.intakeDraft.findMany({
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
          document: {
            select: {
              id: true,
              filename: true,
              mimeType: true,
              // hasThumbnail: boolean derived below — never ship the
              // full base64 payload in a list response.
              thumbnailBase64: true,
            },
          },
        },
      });
      return drafts.map((d) => ({
        ...d,
        document: d.document
          ? {
              id: d.document.id,
              filename: d.document.filename,
              mimeType: d.document.mimeType,
              hasThumbnail: !!d.document.thumbnailBase64,
            }
          : null,
      }));
    }),

  /** Lazy-load the source-image thumbnail for a diagram intake.
   *  Kept off listDocuments / listDrafts to avoid shipping ~500KB
   *  base64 across every panel render. */
  getThumbnail: workspaceProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const doc = await ctx.db.intakeDocument.findFirst({
        where: { id: input.documentId, workspaceId: ctx.workspaceId },
        select: { thumbnailBase64: true, thumbnailMimeType: true },
      });
      if (!doc || !doc.thumbnailBase64 || !doc.thumbnailMimeType) {
        return null;
      }
      return {
        dataUri: `data:${doc.thumbnailMimeType};base64,${doc.thumbnailBase64}`,
        mimeType: doc.thumbnailMimeType,
      };
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
          // `undefined` lets Prisma apply the schema default
          // (NOT_ASSESSED) when the doc didn't specify.
          currentMaturity: asMaturityOrUndef(payload.currentMaturity),
          targetMaturity: asMaturityOrUndef(payload.targetMaturity),
          strategicImportance: asStrategicImportanceOrUndef(
            payload.strategicImportance
          ),
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
          alias: stringOrNull(payload.alias),
          vendor: stringOrNull(payload.vendor),
          version: stringOrNull(payload.version),
          applicationType: asAppType(payload.applicationType),
          deploymentModel: asDeploymentModelOrUndef(payload.deploymentModel),
          lifecycle: asLifecycle(payload.lifecycle),
          businessValue: asBusinessValueOrUndef(payload.businessValue),
          technicalHealth: asTechnicalHealthOrUndef(payload.technicalHealth),
          rationalizationStatus: asRationalizationStatusOrUndef(
            payload.rationalizationStatus
          ),
          annualCostUsd: asDecimalOrUndef(payload.annualCostUsd),
          costCurrency: asCurrencyCodeOrUndef(payload.costCurrency),
          costModel: asCostModelOrUndef(payload.costModel),
          licensedUsers: asIntOrUndef(payload.licensedUsers),
          actualUsers: asIntOrUndef(payload.actualUsers),
          businessOwnerName: stringOrNull(payload.businessOwnerName),
          itOwnerName: stringOrNull(payload.itOwnerName),
          functionalFit: asFunctionalFitOrUndef(payload.functionalFit),
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
          status: asRiskStatusOrUndef(payload.status),
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
          website: stringOrNull(payload.website),
          category: asVendorCategoryOrUndef(payload.category),
          status: asVendorStatusOrUndef(payload.status),
          headquartersCountry: stringOrNull(payload.headquartersCountry),
          annualSpend: asDecimalOrUndef(payload.annualSpend),
          currency: asCurrencyCodeOrUndef(payload.currency),
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
          budgetUsd: asDecimalOrUndef(payload.budgetUsd),
          budgetCurrency: asCurrencyCodeOrUndef(payload.budgetCurrency),
          businessSponsor: stringOrNull(payload.businessSponsor),
          sourceType: stringOrNull(payload.sourceType) ?? "AI_AGENT",
          sourceContext: stringOrNull(payload.sourceContext),
        },
        select: { id: true },
      });
    }
    case "OBJECTIVE": {
      const name = String(payload.name ?? "").trim();
      if (!name)
        throw new TRPCError({ code: "BAD_REQUEST", message: "name required" });
      return ctx.db.objective.create({
        data: {
          workspaceId: ctx.workspaceId,
          name,
          description: stringOrNull(payload.description),
          targetDate: parseDateOrNull(payload.targetDate),
          kpiDescription: stringOrNull(payload.kpiDescription),
          kpiTarget: stringOrNull(payload.kpiTarget),
        },
        select: { id: true },
      });
    }
    case "COMPLIANCE_REQUIREMENT": {
      const title = String(payload.title ?? "").trim();
      if (!title)
        throw new TRPCError({ code: "BAD_REQUEST", message: "title required" });
      const framework = asComplianceFrameworkOrCustom(payload.framework);
      const controlId =
        String(payload.controlId ?? "").trim() || "OVERVIEW";
      try {
        return await ctx.db.complianceRequirement.create({
          data: {
            workspaceId: ctx.workspaceId,
            framework,
            controlId,
            title,
            description: stringOrNull(payload.description),
            category: stringOrNull(payload.category),
            isMandatory:
              typeof payload.isMandatory === "boolean"
                ? payload.isMandatory
                : true,
            auditFrequency: stringOrNull(payload.auditFrequency),
          },
          select: { id: true },
        });
      } catch (err) {
        // P2002 = unique constraint violation on
        // (workspaceId, framework, controlId). Re-uploads of the
        // same doc will collide here.
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code?: string }).code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Compliance requirement "${title}" already exists for ${framework}/${controlId}.`,
          });
        }
        throw err;
      }
    }
    case "EOL_WATCH": {
      const entityName = String(payload.entityName ?? "").trim();
      if (!entityName)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "entityName required",
        });
      const eolDate = parseDateOrNull(payload.eolDate);
      return ctx.db.eolWatchEntry.create({
        data: {
          workspaceId: ctx.workspaceId,
          // Phase 3 will reconcile to actual Application / Tech rows.
          // Until then, mark as EXTERNAL with a synthetic id.
          entityType: "EXTERNAL",
          entityId: crypto.randomUUID(),
          entityName,
          eolDate,
          eosDate: parseDateOrNull(payload.eosDate),
          vendor: stringOrNull(payload.vendor),
          notes: stringOrNull(payload.notes),
          urgencyBand: computeUrgencyBand(eolDate),
        },
        select: { id: true },
      });
    }
    case "ARCH_STATE": {
      const label = String(payload.label ?? "").trim();
      if (!label)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "label required",
        });
      const description = stringOrNull(payload.description);
      return ctx.db.architectureState.create({
        data: {
          workspaceId: ctx.workspaceId,
          stateType: asArchStateType(payload.stateType),
          label,
          description,
          // snapshot is a structured JSON column meant for
          // diagram/state payloads later. Stash the narrative now
          // so we don't lose it; structured snapshot is Phase 3+.
          snapshot: { narrative: description ?? "" },
        },
        select: { id: true },
      });
    }
    case "WORKSPACE_PROFILE": {
      // Singleton: updates the Workspace row instead of creating
      // a new record. Only writes fields the LLM produced; existing
      // values survive when the payload field is missing.
      const updates: Record<string, unknown> = {};
      const itVision = stringOrNull(payload.itVision);
      if (itVision) updates.itVision = itVision;
      const missionStatement = stringOrNull(payload.missionStatement);
      if (missionStatement) updates.missionStatement = missionStatement;
      const brandColor = asHexColorOrUndef(payload.brandColor);
      if (brandColor) updates.brandColor = brandColor;
      const industry = asIndustryOrCustom(payload.industry);
      if (industry) updates.industry = industry;
      if (Object.keys(updates).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Workspace profile draft has no extractable fields to apply.",
        });
      }
      await ctx.db.workspace.update({
        where: { id: ctx.workspaceId },
        data: updates,
      });
      // Return the workspaceId since there's no separate
      // "created entity" row.
      return { id: ctx.workspaceId };
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

// ─────────────────────────────────────────────────────────────
// `*OrUndef` coercers — return `undefined` when the LLM didn't
// emit the field, so Prisma applies the schema default
// (NOT_ASSESSED, BV_UNKNOWN, etc.) instead of overwriting with a
// guessed fallback. Per intakeExtractor.v2 rule #8, the LLM only
// emits these when the source explicitly says so.

function enumOrUndef<T extends string>(
  v: unknown,
  allowed: readonly T[]
): T | undefined {
  if (v == null) return undefined;
  const s = String(v).toUpperCase().replace(/\s+/g, "_");
  return (allowed as readonly string[]).includes(s) ? (s as T) : undefined;
}

function asMaturityOrUndef(v: unknown) {
  return enumOrUndef(v, [
    "INITIAL",
    "DEVELOPING",
    "DEFINED",
    "MANAGED",
    "OPTIMIZING",
  ] as const);
}

function asStrategicImportanceOrUndef(v: unknown) {
  return enumOrUndef(v, ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const);
}

function asDeploymentModelOrUndef(v: unknown) {
  return enumOrUndef(v, [
    "CLOUD_PUBLIC",
    "CLOUD_PRIVATE",
    "ON_PREMISE",
    "HYBRID",
    "SAAS_HOSTED",
    "UNKNOWN",
  ] as const);
}

function asBusinessValueOrUndef(v: unknown) {
  return enumOrUndef(v, [
    "CRITICAL",
    "HIGH",
    "MEDIUM",
    "LOW",
    "BV_UNKNOWN",
  ] as const);
}

function asTechnicalHealthOrUndef(v: unknown) {
  return enumOrUndef(v, [
    "EXCELLENT",
    "GOOD",
    "FAIR",
    "POOR",
    "TH_CRITICAL",
    "TH_UNKNOWN",
  ] as const);
}

function asRationalizationStatusOrUndef(v: unknown) {
  return enumOrUndef(v, [
    "TOLERATE",
    "INVEST",
    "MIGRATE",
    "ELIMINATE",
  ] as const);
}

function asCostModelOrUndef(v: unknown) {
  return enumOrUndef(v, [
    "LICENSE_PER_USER",
    "LICENSE_FLAT",
    "SUBSCRIPTION",
    "USAGE_BASED",
    "OPEN_SOURCE",
    "INTERNAL",
  ] as const);
}

function asFunctionalFitOrUndef(v: unknown) {
  return enumOrUndef(v, [
    "EXCELLENT",
    "GOOD",
    "ADEQUATE",
    "POOR",
    "UNFIT",
    "FF_UNKNOWN",
  ] as const);
}

function asRiskStatusOrUndef(v: unknown) {
  return enumOrUndef(v, [
    "OPEN",
    "IN_PROGRESS",
    "MITIGATED",
    "ACCEPTED",
    "CLOSED",
  ] as const);
}

function asVendorCategoryOrUndef(v: unknown) {
  return enumOrUndef(v, [
    "HYPERSCALER",
    "SOFTWARE",
    "HARDWARE",
    "SERVICES",
    "OPEN_SOURCE_FOUNDATION",
    "INTERNAL",
    "OTHER",
  ] as const);
}

function asVendorStatusOrUndef(v: unknown) {
  return enumOrUndef(v, [
    "ACTIVE",
    "STRATEGIC",
    "UNDER_REVIEW",
    "EXITING",
    "DEPRECATED",
  ] as const);
}

/** Parses a number-or-numeric-string. Strips commas and currency
 *  symbols. Rejects non-finite or negative. Returns undefined when
 *  unparseable so Prisma leaves the column null. */
function asDecimalOrUndef(v: unknown): number | undefined {
  if (typeof v === "number") {
    return Number.isFinite(v) && v >= 0 ? v : undefined;
  }
  if (typeof v !== "string") return undefined;
  const cleaned = v.replace(/[$£€¥,\s]/g, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function asIntOrUndef(v: unknown): number | undefined {
  const n = asDecimalOrUndef(v);
  if (n == null) return undefined;
  const i = Math.floor(n);
  return i >= 0 ? i : undefined;
}

/** Three-letter ISO currency code, uppercased. Returns undefined
 *  for missing/garbage so the schema default ("USD") applies. */
function asCurrencyCodeOrUndef(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : undefined;
}

// ─────────────────────────────────────────────────────────────
// Phase 2 helpers — coercers and parsers for the new entity types

const COMPLIANCE_FRAMEWORK_VALUES = [
  "SOC2_TYPE2",
  "ISO_27001",
  "GDPR",
  "PCI_DSS",
  "HIPAA",
  "NIST_CSF",
  "CIS_CONTROLS",
  "SOX",
  "PIPEDA",
  "DORA",
  "NIS2",
  "ISO_27701",
  "FEDRAMP_MODERATE",
  "CUSTOM",
] as const;

type ComplianceFrameworkValue = (typeof COMPLIANCE_FRAMEWORK_VALUES)[number];

/** Best-effort match to a ComplianceFramework enum value. Returns
 *  CUSTOM for anything we can't map (UNECE, ISO 21434, CSRD, etc.).
 *  The original framework name should still be preserved in the
 *  title or category by the caller. */
function asComplianceFrameworkOrCustom(v: unknown): ComplianceFrameworkValue {
  const s = String(v ?? "").toUpperCase().replace(/[\s\-]+/g, "_");
  return (COMPLIANCE_FRAMEWORK_VALUES as readonly string[]).includes(s)
    ? (s as ComplianceFrameworkValue)
    : "CUSTOM";
}

function asArchStateType(v: unknown): "AS_IS" | "TO_BE" {
  const s = String(v ?? "").toUpperCase().replace(/\s+/g, "_");
  return s === "TO_BE" ? "TO_BE" : "AS_IS";
}

const INDUSTRY_VALUES = [
  "BANKING",
  "RETAIL",
  "LOGISTICS",
  "MANUFACTURING",
  "HEALTHCARE",
  "GENERIC",
  "ENTERPRISE_BCM",
  "INSURANCE",
  "TELECOM",
  "ENERGY_UTILITIES",
  "PUBLIC_SECTOR",
  "PHARMA_LIFESCIENCES",
] as const;

type IndustryValue = (typeof INDUSTRY_VALUES)[number];

/** Best-effort match to IndustryType. Returns undefined if no
 *  reasonable match — caller skips the update so existing value
 *  survives. Free-form synonyms ("automotive", "auto", "OEM")
 *  collapse to MANUFACTURING. */
function asIndustryOrCustom(v: unknown): IndustryValue | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().toUpperCase().replace(/[\s\-]+/g, "_");
  if (!s) return undefined;
  if ((INDUSTRY_VALUES as readonly string[]).includes(s)) {
    return s as IndustryValue;
  }
  // Free-form fallbacks
  if (/AUTOMOTIVE|AUTO|OEM|VEHICLE/.test(s)) return "MANUFACTURING";
  if (/FINANCE|BANK/.test(s)) return "BANKING";
  if (/PHARMA|LIFE.SCI/.test(s)) return "PHARMA_LIFESCIENCES";
  if (/UTILITY|UTILITIES|ENERGY/.test(s)) return "ENERGY_UTILITIES";
  if (/PUBLIC|GOV/.test(s)) return "PUBLIC_SECTOR";
  return undefined;
}

/** Normalize a workspace brand color to "#rrggbb" or undefined. */
function asHexColorOrUndef(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{6}$/.test(s)) return `#${s}`;
  if (/^[0-9a-f]{3}$/.test(s)) {
    return `#${s
      .split("")
      .map((c) => c + c)
      .join("")}`;
  }
  return undefined;
}

/** Parse an ISO date or anything Date can swallow. Rejects fiscal
 *  strings ("FY27 Q4") and bare years — those stay in description
 *  /kpiTarget as prose. Returns null when unparseable. */
function parseDateOrNull(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  // Reject fiscal-year-style strings — the date column wants a
  // real date, not a quarter label.
  if (/^FY|^Q[1-4]\b/i.test(s)) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  // Reject bare years (Date parses "2027" as 2027-01-01 in some
  // engines). Require at least YYYY-MM.
  if (/^\d{4}$/.test(s)) return null;
  return d;
}

/** EolWatch urgency: past/within 6mo = CRITICAL, within 18mo =
 *  WARNING, otherwise HEALTHY. Null date defaults to HEALTHY since
 *  we don't know how urgent it is yet. */
function computeUrgencyBand(
  eolDate: Date | null
): "CRITICAL" | "WARNING" | "HEALTHY" {
  if (!eolDate) return "HEALTHY";
  const now = Date.now();
  const eol = eolDate.getTime();
  const sixMonthsMs = 1000 * 60 * 60 * 24 * 30 * 6;
  const eighteenMonthsMs = 1000 * 60 * 60 * 24 * 30 * 18;
  if (eol - now <= sixMonthsMs) return "CRITICAL";
  if (eol - now <= eighteenMonthsMs) return "WARNING";
  return "HEALTHY";
}
