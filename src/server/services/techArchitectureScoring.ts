import type { db } from "@/server/db";

type DB = typeof db;

export type ApplicationTechScore = {
  applicationId: string;
  applicationName: string;
  componentsLinked: number;
  eolRiskCount: number;
  prohibitedCount: number;
  deprecatedCount: number;
  mandatoryGaps: number;
  score: number;
  band: "GREEN" | "AMBER" | "RED";
};

const dayMs = 86_400_000;

export async function scoreApplicationTechPortfolio(
  dbx: DB,
  workspaceId: string
): Promise<ApplicationTechScore[]> {
  const apps = await dbx.application.findMany({
    where: { workspaceId, isActive: true },
    select: {
      id: true,
      name: true,
      technologyComponents: {
        include: {
          component: {
            include: {
              product: { select: { id: true } },
              version: {
                select: {
                  id: true,
                  lifecycleStatus: true,
                  endOfLifeDate: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const standards = await dbx.technologyStandard.findMany({
    where: { workspaceId, isActive: true, status: "ACTIVE" },
    select: { id: true, level: true, productId: true, versionId: true },
  });

  const prohibitedProducts = new Set(
    standards.filter((s) => s.level === "PROHIBITED" && s.productId).map((s) => s.productId!)
  );
  const prohibitedVersions = new Set(
    standards.filter((s) => s.level === "PROHIBITED" && s.versionId).map((s) => s.versionId!)
  );
  const deprecatedProducts = new Set(
    standards.filter((s) => s.level === "DEPRECATED" && s.productId).map((s) => s.productId!)
  );
  const deprecatedVersions = new Set(
    standards.filter((s) => s.level === "DEPRECATED" && s.versionId).map((s) => s.versionId!)
  );

  const now = Date.now();

  return apps.map((app) => {
    let eolRiskCount = 0;
    let prohibitedCount = 0;
    let deprecatedCount = 0;
    for (const link of app.technologyComponents) {
      const c = link.component;
      const v = c.version;
      if (v) {
        if (v.lifecycleStatus === "END_OF_LIFE") eolRiskCount += 1;
        else if (
          v.endOfLifeDate &&
          v.endOfLifeDate.getTime() - now <= 90 * dayMs
        )
          eolRiskCount += 1;
      }
      const pid = c.product.id;
      const vid = v?.id;
      if (prohibitedProducts.has(pid) || (vid && prohibitedVersions.has(vid)))
        prohibitedCount += 1;
      else if (deprecatedProducts.has(pid) || (vid && deprecatedVersions.has(vid)))
        deprecatedCount += 1;
    }

    const mandatoryGaps = 0;
    const componentsLinked = app.technologyComponents.length;

    let score = 100;
    score -= prohibitedCount * 25;
    score -= deprecatedCount * 10;
    score -= eolRiskCount * 15;
    if (componentsLinked === 0) score -= 20;
    score = Math.max(0, Math.min(100, score));

    const band: ApplicationTechScore["band"] =
      score >= 80 ? "GREEN" : score >= 50 ? "AMBER" : "RED";

    return {
      applicationId: app.id,
      applicationName: app.name,
      componentsLinked,
      eolRiskCount,
      prohibitedCount,
      deprecatedCount,
      mandatoryGaps,
      score,
      band,
    };
  });
}

export async function scoreSingleApplication(
  dbx: DB,
  workspaceId: string,
  applicationId: string
): Promise<ApplicationTechScore | null> {
  const all = await scoreApplicationTechPortfolio(dbx, workspaceId);
  return all.find((s) => s.applicationId === applicationId) ?? null;
}
