import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";
import { COMPLIANCE_TEMPLATES } from "@/lib/constants/compliance-templates";

const FRAMEWORKS = [
  "SOC2_TYPE2", "ISO_27001", "GDPR", "PCI_DSS", "HIPAA",
  "NIST_CSF", "CIS_CONTROLS", "SOX", "PIPEDA", "CUSTOM",
] as const;

export const complianceRouter = router({
  listRequirements: workspaceProcedure
    .input(
      z.object({
        framework: z.enum(FRAMEWORKS),
      })
    )
    .query(async ({ ctx, input }) => {
      const requirements = await ctx.db.complianceRequirement.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          framework: input.framework,
          isApplicable: true,
        },
        include: {
          mappings: {
            select: { id: true, status: true, entityType: true, entityId: true, entityName: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      });
      return requirements;
    }),

  getScorecard: workspaceProcedure.query(async ({ ctx }) => {
    const requirements = await ctx.db.complianceRequirement.findMany({
      where: { workspaceId: ctx.workspaceId, isApplicable: true },
      include: {
        mappings: { select: { status: true } },
      },
    });

    // Group by framework
    const frameworkMap: Record<
      string,
      { total: number; compliant: number; partial: number; nonCompliant: number; notAssessed: number; exempt: number }
    > = {};

    for (const req of requirements) {
      const fw = req.framework;
      if (!frameworkMap[fw]) {
        frameworkMap[fw] = { total: 0, compliant: 0, partial: 0, nonCompliant: 0, notAssessed: 0, exempt: 0 };
      }
      frameworkMap[fw].total++;

      // Roll up: if all mappings compliant → compliant; any non-compliant → non-compliant; etc.
      if (req.mappings.length === 0) {
        frameworkMap[fw].notAssessed++;
      } else if (req.mappings.every((m) => m.status === "COMPLIANT")) {
        frameworkMap[fw].compliant++;
      } else if (req.mappings.some((m) => m.status === "NON_COMPLIANT")) {
        frameworkMap[fw].nonCompliant++;
      } else if (req.mappings.every((m) => m.status === "EXEMPT")) {
        frameworkMap[fw].exempt++;
      } else if (req.mappings.some((m) => m.status === "PARTIAL")) {
        frameworkMap[fw].partial++;
      } else {
        frameworkMap[fw].notAssessed++;
      }
    }

    return Object.entries(frameworkMap).map(([framework, counts]) => {
      const assessed = counts.compliant + counts.partial + counts.nonCompliant + counts.exempt;
      const score =
        counts.total > 0
          ? Math.round(((counts.compliant + counts.exempt) / counts.total) * 100)
          : 0;
      return { framework, score, assessed, ...counts };
    });
  }),

  assess: workspaceProcedure
    .input(
      z.object({
        requirementId: z.string(),
        entityType: z.string(),
        entityId: z.string(),
        entityName: z.string(),
        status: z.enum(["COMPLIANT", "PARTIAL", "NON_COMPLIANT", "NOT_ASSESSED", "EXEMPT"]),
        evidence: z.string().optional(),
        nextReviewDate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify requirement belongs to workspace
      const requirement = await ctx.db.complianceRequirement.findFirst({
        where: { id: input.requirementId, workspaceId: ctx.workspaceId },
      });
      if (!requirement) throw new TRPCError({ code: "NOT_FOUND" });

      const existing = await ctx.db.complianceMapping.findFirst({
        where: {
          requirementId: input.requirementId,
          entityType: input.entityType,
          entityId: input.entityId,
        },
      });

      const mapping = await ctx.db.complianceMapping.upsert({
        where: {
          requirementId_entityType_entityId: {
            requirementId: input.requirementId,
            entityType: input.entityType,
            entityId: input.entityId,
          },
        },
        create: {
          requirementId: input.requirementId,
          workspaceId: ctx.workspaceId,
          entityType: input.entityType,
          entityId: input.entityId,
          entityName: input.entityName,
          status: input.status,
          evidence: input.evidence ?? null,
          assessedById: ctx.dbUserId ?? null,
          assessedAt: new Date(),
          nextReviewDate: input.nextReviewDate ? new Date(input.nextReviewDate) : null,
          notes: input.notes ?? null,
        },
        update: {
          status: input.status,
          evidence: input.evidence ?? null,
          assessedById: ctx.dbUserId ?? null,
          assessedAt: new Date(),
          nextReviewDate: input.nextReviewDate ? new Date(input.nextReviewDate) : null,
          notes: input.notes ?? null,
        },
      });

      auditLog(ctx, {
        action: existing ? "UPDATE" : "ASSESS",
        entityType: "ComplianceMapping",
        entityId: mapping.id,
        before: existing ? { status: existing.status } as Record<string, unknown> : undefined,
        after: { status: input.status, requirementId: input.requirementId } as Record<string, unknown>,
      });
      return mapping;
    }),

  importFramework: workspaceProcedure
    .input(
      z.object({
        framework: z.enum(FRAMEWORKS),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const templates = COMPLIANCE_TEMPLATES[input.framework] ?? [];
      if (templates.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No template found for framework ${input.framework}`,
        });
      }

      let imported = 0;
      let skipped = 0;

      for (const tpl of templates) {
        const existing = await ctx.db.complianceRequirement.findFirst({
          where: {
            workspaceId: ctx.workspaceId,
            framework: input.framework,
            controlId: tpl.controlId,
          },
        });
        if (existing) {
          skipped++;
          continue;
        }

        await ctx.db.complianceRequirement.create({
          data: {
            workspaceId: ctx.workspaceId,
            framework: input.framework,
            controlId: tpl.controlId,
            title: tpl.title,
            description: tpl.description,
            category: tpl.category,
            isMandatory: tpl.isMandatory,
            isApplicable: true,
            sortOrder: tpl.sortOrder,
          },
        });
        imported++;
      }

      auditLog(ctx, {
        action: "IMPORT",
        entityType: "ComplianceRequirement",
        entityId: `${ctx.workspaceId}-${input.framework}`,
        after: { framework: input.framework, imported, skipped } as Record<string, unknown>,
      });
      return { imported, skipped };
    }),

  getImportedFrameworks: workspaceProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.complianceRequirement.groupBy({
      by: ["framework"],
      where: { workspaceId: ctx.workspaceId },
      _count: { framework: true },
    });
    return result.map((r) => ({ framework: r.framework, count: r._count.framework }));
  }),
});
