import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { RationalizationMetrics } from "./buildRationalizationDocx";

/**
 * Compute deterministic rationalization metrics for a workspace.
 * Shared between the `application.getRationalizationMetrics` tRPC
 * procedure (UI consumption) and the `/api/export/deliverable-docx`
 * route (DOCX consumption) so the dashboard and the deliverable
 * never disagree on the numbers.
 */
export async function computeRationalizationMetrics(
  db: PrismaClient,
  workspaceId: string
): Promise<RationalizationMetrics> {
  const apps = await db.application.findMany({
    where: { workspaceId, isActive: true },
    select: {
      id: true,
      name: true,
      vendor: true,
      rationalizationStatus: true,
      lifecycle: true,
      businessValue: true,
      technicalHealth: true,
      annualCostUsd: true,
      costCurrency: true,
      capabilities: {
        select: {
          capability: { select: { id: true, name: true } },
        },
      },
    },
  });

  type AppSummary = RationalizationMetrics["topEliminationCandidates"][number];

  const summarize = (app: (typeof apps)[number]): AppSummary => ({
    id: app.id,
    name: app.name,
    vendor: app.vendor,
    rationalizationStatus: app.rationalizationStatus,
    lifecycle: app.lifecycle,
    businessValue: app.businessValue,
    technicalHealth: app.technicalHealth,
    annualCostUsd: Number(app.annualCostUsd ?? 0),
    capabilityNames: app.capabilities
      .map((m) => m.capability?.name)
      .filter((n): n is string => !!n),
  });

  const buckets = {
    TOLERATE: { count: 0, annualCostUsd: 0, apps: [] as AppSummary[] },
    INVEST: { count: 0, annualCostUsd: 0, apps: [] as AppSummary[] },
    MIGRATE: { count: 0, annualCostUsd: 0, apps: [] as AppSummary[] },
    ELIMINATE: { count: 0, annualCostUsd: 0, apps: [] as AppSummary[] },
  } as Record<
    string,
    { count: number; annualCostUsd: number; apps: AppSummary[] }
  >;

  let activeApps = 0;
  let classifiedApps = 0;

  for (const app of apps) {
    if (app.lifecycle === "ACTIVE") activeApps++;
    const status = app.rationalizationStatus;
    if (status && status in buckets) {
      const summary = summarize(app);
      buckets[status]!.count++;
      buckets[status]!.annualCostUsd += summary.annualCostUsd;
      buckets[status]!.apps.push(summary);
      classifiedApps++;
    }
  }

  const sortByCostDesc = (a: AppSummary, b: AppSummary) =>
    b.annualCostUsd - a.annualCostUsd;
  const topEliminationCandidates = (buckets.ELIMINATE?.apps ?? [])
    .slice()
    .sort(sortByCostDesc)
    .slice(0, 10);
  const topMigrationCandidates = (buckets.MIGRATE?.apps ?? [])
    .slice()
    .sort(sortByCostDesc)
    .slice(0, 10);

  const capMap = new Map<
    string,
    { name: string; appsCovering: AppSummary[] }
  >();
  for (const app of apps) {
    const summary = summarize(app);
    for (const m of app.capabilities) {
      if (!m.capability) continue;
      const entry = capMap.get(m.capability.id) ?? {
        name: m.capability.name,
        appsCovering: [],
      };
      entry.appsCovering.push(summary);
      capMap.set(m.capability.id, entry);
    }
  }
  const redundancyMatrix = Array.from(capMap.values())
    .filter((entry) => entry.appsCovering.length >= 2)
    .sort((a, b) => b.appsCovering.length - a.appsCovering.length)
    .map((entry) => ({
      capabilityName: entry.name,
      appsCovering: entry.appsCovering,
    }));

  const eliminate3yrUsd = (buckets.ELIMINATE?.annualCostUsd ?? 0) * 3;
  const migrate3yrUsd = (buckets.MIGRATE?.annualCostUsd ?? 0) * 0.5 * 3;
  const totalCandidate3yrUsd = eliminate3yrUsd + migrate3yrUsd;

  // Extra aggregates used by the v2 templates ─────────────────
  const totalAnnualCostUsd = apps.reduce(
    (s, a) => s + Number(a.annualCostUsd ?? 0),
    0
  );

  const allAppSummaries = apps.map((a) => summarize(a));
  const topAppsByCost = allAppSummaries
    .slice()
    .sort(sortByCostDesc)
    .slice(0, 10);

  const lifecycleDistribution: Record<
    string,
    { count: number; annualCostUsd: number }
  > = {};
  for (const a of allAppSummaries) {
    const key = a.lifecycle;
    if (!lifecycleDistribution[key]) {
      lifecycleDistribution[key] = { count: 0, annualCostUsd: 0 };
    }
    lifecycleDistribution[key]!.count++;
    lifecycleDistribution[key]!.annualCostUsd += a.annualCostUsd;
  }

  const vendorMap = new Map<
    string,
    { vendor: string; count: number; annualCostUsd: number }
  >();
  for (const a of allAppSummaries) {
    const v = a.vendor?.trim() || "(unknown)";
    const entry = vendorMap.get(v) ?? {
      vendor: v,
      count: 0,
      annualCostUsd: 0,
    };
    entry.count++;
    entry.annualCostUsd += a.annualCostUsd;
    vendorMap.set(v, entry);
  }
  const vendorConcentration = Array.from(vendorMap.values())
    .sort((a, b) => b.annualCostUsd - a.annualCostUsd)
    .slice(0, 10);

  // Ranked "classify these first" list — combines lifecycle urgency
  // + cost magnitude + capability-orphan signal. Used by the
  // Portfolio Snapshot Report when classification coverage is low.
  type ClassifyHint = AppSummary & { reason: string };
  const unclassified = allAppSummaries.filter(
    (a) => !a.rationalizationStatus
  );
  const classifyFirst: ClassifyHint[] = [];

  // 1. PHASING_OUT — active retirement candidates need a decision.
  for (const a of unclassified) {
    if (a.lifecycle === "PHASING_OUT" || a.lifecycle === "RETIRED") {
      classifyFirst.push({
        ...a,
        reason: "Active retirement candidate — disposition decision overdue.",
      });
    }
  }
  // 2. Highest cost (top 8) — biggest impact when classified.
  const byCostDesc = unclassified
    .filter((a) => a.lifecycle === "ACTIVE" && a.annualCostUsd > 0)
    .sort(sortByCostDesc);
  for (const a of byCostDesc) {
    if (classifyFirst.find((x) => x.id === a.id)) continue;
    if (classifyFirst.length >= 12) break;
    classifyFirst.push({
      ...a,
      reason: `${a.annualCostUsd > 0 ? "High annual cost" : "Cost not set"} — classify to surface savings or investment.`,
    });
  }
  // 3. Orphaned (no capability mappings) — gap in the model that
  //    blocks redundancy analysis.
  const orphaned = unclassified.filter(
    (a) => a.capabilityNames.length === 0
  );
  for (const a of orphaned) {
    if (classifyFirst.find((x) => x.id === a.id)) continue;
    if (classifyFirst.length >= 12) break;
    classifyFirst.push({
      ...a,
      reason: "No capability mappings — orphan blocks redundancy analysis.",
    });
  }

  const assumptions = [
    "Horizon: 3 years from the report date.",
    "ELIMINATE candidates: 100% of annualCostUsd avoided over the horizon.",
    "MIGRATE candidates: 50% of annualCostUsd avoided over the horizon (typical SaaS swap saves roughly half on license + run-cost).",
    "Discount rate: not applied in this version (savings stated in nominal dollars).",
    "Excludes one-time decommission and migration costs — surface those separately when building a business case.",
    "Costs reflect the values stored on each Application record at the time of generation; refresh those for an up-to-date picture.",
  ];

  const currencyCounts: Record<string, number> = {};
  for (const app of apps) {
    const c = app.costCurrency ?? "USD";
    currencyCounts[c] = (currencyCounts[c] ?? 0) + 1;
  }
  let costCurrency = "USD";
  let maxCount = 0;
  for (const [c, count] of Object.entries(currencyCounts)) {
    if (count > maxCount) {
      costCurrency = c;
      maxCount = count;
    }
  }

  const coverageRatio =
    apps.length > 0 ? classifiedApps / apps.length : 0;

  return {
    totalApps: apps.length,
    activeApps,
    classifiedApps,
    coverageRatio,
    byClassification: buckets,
    topEliminationCandidates,
    topMigrationCandidates,
    redundancyMatrix,
    projectedSavings: {
      eliminate3yrUsd,
      migrate3yrUsd,
      totalCandidate3yrUsd,
      assumptions,
    },
    costCurrency,
    totalAnnualCostUsd,
    topAppsByCost,
    lifecycleDistribution,
    vendorConcentration,
    classifyFirst,
  };
}
