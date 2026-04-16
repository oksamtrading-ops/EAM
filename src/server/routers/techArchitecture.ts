import { z } from "zod";
import { router, workspaceProcedure } from "@/server/trpc";
import {
  computeTechArchitectureFindings,
  type TechArchFinding,
} from "@/server/services/techArchitectureFindings";
import { scoreSingleApplication } from "@/server/services/techArchitectureScoring";

export const techArchitectureRouter = router({
  kpis: workspaceProcedure.query(async ({ ctx }) => {
    const [
      vendorCount,
      productCount,
      versionCount,
      componentCount,
      appsTotal,
      standardCount,
      activeStandardCount,
      referenceArchCount,
      activeReferenceArchCount,
    ] = await Promise.all([
      ctx.db.vendor.count({ where: { workspaceId: ctx.workspaceId, isActive: true } }),
      ctx.db.technologyProduct.count({
        where: { workspaceId: ctx.workspaceId, isActive: true },
      }),
      ctx.db.technologyVersion.count({
        where: { workspaceId: ctx.workspaceId, isActive: true },
      }),
      ctx.db.technologyComponent.count({
        where: { workspaceId: ctx.workspaceId, isActive: true },
      }),
      ctx.db.application.count({
        where: { workspaceId: ctx.workspaceId, isActive: true },
      }),
      ctx.db.technologyStandard.count({
        where: { workspaceId: ctx.workspaceId, isActive: true },
      }),
      ctx.db.technologyStandard.count({
        where: { workspaceId: ctx.workspaceId, isActive: true, status: "ACTIVE" },
      }),
      ctx.db.referenceArchitecture.count({
        where: { workspaceId: ctx.workspaceId, isActive: true },
      }),
      ctx.db.referenceArchitecture.count({
        where: { workspaceId: ctx.workspaceId, isActive: true, status: "ACTIVE" },
      }),
    ]);

    const now = new Date();
    const in90 = new Date();
    in90.setDate(in90.getDate() + 90);

    const atRiskComponents = await ctx.db.technologyComponent.count({
      where: {
        workspaceId: ctx.workspaceId,
        isActive: true,
        OR: [
          { version: { endOfLifeDate: { lt: now } } },
          { version: { endOfLifeDate: { gte: now, lte: in90 } } },
          { version: { lifecycleStatus: "END_OF_LIFE" } },
        ],
      },
    });

    const linkedApps = await ctx.db.application.count({
      where: {
        workspaceId: ctx.workspaceId,
        isActive: true,
        technologyComponents: { some: {} },
      },
    });

    const coveragePct = appsTotal === 0 ? 0 : Math.round((linkedApps / appsTotal) * 100);

    const findings = await computeTechArchitectureFindings(ctx.db, ctx.workspaceId);
    const findingsBySeverity = {
      high: findings.filter((f) => f.severity === "HIGH").length,
      medium: findings.filter((f) => f.severity === "MEDIUM").length,
      low: findings.filter((f) => f.severity === "LOW").length,
    };

    return {
      vendorCount,
      productCount,
      versionCount,
      componentCount,
      atRiskComponents,
      appsTotal,
      linkedApps,
      coveragePct,
      standardCount,
      activeStandardCount,
      referenceArchCount,
      activeReferenceArchCount,
      findingsTotal: findings.length,
      findingsBySeverity,
    };
  }),

  findings: workspaceProcedure.query(async ({ ctx }): Promise<TechArchFinding[]> => {
    return computeTechArchitectureFindings(ctx.db, ctx.workspaceId);
  }),

  applicationScore: workspaceProcedure
    .input(z.object({ applicationId: z.string() }))
    .query(async ({ ctx, input }) => {
      return scoreSingleApplication(ctx.db, ctx.workspaceId, input.applicationId);
    }),
});
