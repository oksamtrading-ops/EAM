import { router, workspaceProcedure } from "@/server/trpc";

/**
 * Unified lightweight search index for the global Cmd+K palette.
 * One round-trip fetches everything; client fuzzy-matches locally.
 */
export const searchRouter = router({
  index: workspaceProcedure.query(async ({ ctx }) => {
    const [apps, caps, risks, inits, tags, orgs] = await Promise.all([
      ctx.db.application.findMany({
        where: { workspaceId: ctx.workspaceId, isActive: true },
        select: {
          id: true,
          name: true,
          alias: true,
          vendor: true,
          description: true,
          lifecycle: true,
          rationalizationStatus: true,
          businessValue: true,
          technicalHealth: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 500,
      }),
      ctx.db.businessCapability.findMany({
        where: { workspaceId: ctx.workspaceId, isActive: true },
        select: {
          id: true,
          name: true,
          description: true,
          level: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 500,
      }),
      ctx.db.techRisk.findMany({
        where: { workspaceId: ctx.workspaceId },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          category: true,
          riskScore: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 500,
      }).catch(() => []),
      ctx.db.initiative.findMany({
        where: { workspaceId: ctx.workspaceId },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          horizon: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 500,
      }),
      ctx.db.capabilityTag.findMany({
        where: { workspaceId: ctx.workspaceId },
        select: { id: true, name: true, color: true },
        take: 200,
      }).catch(() => []),
      ctx.db.organization.findMany({
        where: { workspaceId: ctx.workspaceId },
        select: { id: true, name: true },
        take: 200,
      }).catch(() => []),
    ]);

    return { applications: apps, capabilities: caps, risks, initiatives: inits, tags, orgUnits: orgs };
  }),
});
