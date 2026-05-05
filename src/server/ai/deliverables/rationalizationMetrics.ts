import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { RationalizationMetrics } from "./buildRationalizationDocx";

/** Vendor parent aliases — collapse umbrella names to the
 *  negotiating-counterparty level. This is the difference between
 *  Deloitte-tier and BCG-tier vendor analysis: the headline
 *  single-vendor lever in any automotive/industrial portfolio is
 *  the parent group, not the product line. */
const VENDOR_ALIASES: Array<{ pattern: RegExp; parent: string }> = [
  { pattern: /^siemens(\s+digital\s+industries)?$/i, parent: "Siemens" },
  { pattern: /^dassault\s+syst[eè]mes(\s+\([^)]+\))?$/i, parent: "Dassault Systèmes" },
  { pattern: /^delmia(\s+\([^)]+\))?$/i, parent: "Dassault Systèmes" },
  { pattern: /^microsoft(\s+\w+)*$/i, parent: "Microsoft" },
  { pattern: /^salesforce(\.com)?(\s+\w+)*$/i, parent: "Salesforce" },
  { pattern: /^sap(\s+\w+)*$/i, parent: "SAP" },
  { pattern: /^oracle(\s+\w+)*$/i, parent: "Oracle" },
  { pattern: /^ibm(\s+\w+)*$/i, parent: "IBM" },
  { pattern: /^aws|^amazon\s+web\s+services$/i, parent: "AWS" },
  { pattern: /^google\s+cloud|^gcp$/i, parent: "Google Cloud" },
  { pattern: /^adobe(\s+\w+)*$/i, parent: "Adobe" },
  { pattern: /^servicenow(\s+\w+)*$/i, parent: "ServiceNow" },
  { pattern: /^workday(\s+\w+)*$/i, parent: "Workday" },
];

/** Collapse a vendor string to its negotiating-counterparty parent
 *  group. Returns the input trimmed when no alias matches. */
function resolveVendorParent(vendor: string): string {
  const trimmed = vendor.trim();
  for (const alias of VENDOR_ALIASES) {
    if (alias.pattern.test(trimmed)) return alias.parent;
  }
  return trimmed;
}

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

  // Single predicate used by both the classified-counter and the
  // unclassified filter below. Previous version used `!status` for
  // unclassified, which diverged from this predicate when `status`
  // was a truthy non-bucket value (legacy enum, typo, etc.) — apps
  // were counted as "not classified" by classifiedApps but excluded
  // from the unclassified list, leaving classifyFirst empty even
  // though coverage was 0%. That triggered the inverted "ready for
  // full plan" message in the snapshot.
  const isClassified = (status: string | null) =>
    !!status && status in buckets;

  let activeApps = 0;
  let classifiedApps = 0;

  for (const app of apps) {
    if (app.lifecycle === "ACTIVE") activeApps++;
    if (isClassified(app.rationalizationStatus)) {
      const summary = summarize(app);
      const status = app.rationalizationStatus as string;
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

  // Vendor concentration aggregated by parent group via aliases —
  // matches the multiProductVendors rollup so the same Siemens
  // umbrella appears in both views.
  const vendorMap = new Map<
    string,
    { vendor: string; count: number; annualCostUsd: number }
  >();
  for (const a of allAppSummaries) {
    const raw = a.vendor?.trim() || "(unknown)";
    const v = raw === "(unknown)" ? raw : resolveVendorParent(raw);
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
    (a) => !isClassified(a.rationalizationStatus)
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

  // ─── Snapshot-tier aggregates (v2.0) ─────────────────────────

  const phasingOutLifecycles = new Set(["PHASING_OUT", "RETIRED"]);
  const phasingOutApps = allAppSummaries.filter((a) =>
    phasingOutLifecycles.has(a.lifecycle)
  );
  const phasingOutCost = phasingOutApps.reduce(
    (s, a) => s + a.annualCostUsd,
    0
  );
  const phasingOut = {
    count: phasingOutApps.length,
    annualCostUsd: phasingOutCost,
    shareOfTotal:
      totalAnnualCostUsd > 0 ? phasingOutCost / totalAnnualCostUsd : 0,
  };

  // Sourcing split — conservative regex; ambiguous vendors stay
  // third-party so we don't over-claim in-house spend.
  const inHousePattern =
    /^\s*(in[\s-]?house|internal|bespoke|custom|self[\s-]?built|home[\s-]?grown)/i;
  const isInHouse = (vendor: string | null) => {
    const v = (vendor ?? "").trim();
    if (!v) return true;
    return inHousePattern.test(v);
  };
  const inHouseApps = allAppSummaries.filter((a) => isInHouse(a.vendor));
  const thirdPartyApps = allAppSummaries.filter(
    (a) => !isInHouse(a.vendor)
  );
  const inHouseCost = inHouseApps.reduce(
    (s, a) => s + a.annualCostUsd,
    0
  );
  const thirdPartyCost = thirdPartyApps.reduce(
    (s, a) => s + a.annualCostUsd,
    0
  );
  const sourcing = {
    inHouse: {
      count: inHouseApps.length,
      annualCostUsd: inHouseCost,
    },
    thirdParty: {
      count: thirdPartyApps.length,
      annualCostUsd: thirdPartyCost,
    },
    inHouseShare:
      totalAnnualCostUsd > 0 ? inHouseCost / totalAnnualCostUsd : 0,
  };

  // Multi-product vendor exposure — vendors appearing on ≥2 apps,
  // aggregated by parent group via the module-level aliases.
  const multiVendorMap = new Map<
    string,
    {
      vendor: string;
      count: number;
      annualCostUsd: number;
      apps: Array<{ name: string; capabilityNames: string[] }>;
    }
  >();
  for (const a of allAppSummaries) {
    const v = a.vendor?.trim();
    if (!v) continue; // in-house aggregated separately
    if (isInHouse(a.vendor)) continue; // skip in-house pseudo-vendors
    const parent = resolveVendorParent(v);
    const entry = multiVendorMap.get(parent) ?? {
      vendor: parent,
      count: 0,
      annualCostUsd: 0,
      apps: [],
    };
    entry.count++;
    entry.annualCostUsd += a.annualCostUsd;
    entry.apps.push({
      name: a.name,
      capabilityNames: a.capabilityNames,
    });
    multiVendorMap.set(parent, entry);
  }
  const multiProductVendors = Array.from(multiVendorMap.values())
    .filter((e) => e.count >= 2)
    .sort((a, b) => b.annualCostUsd - a.annualCostUsd)
    .slice(0, 5);

  // Top-N concentration ratios.
  const sortedCosts = allAppSummaries
    .map((a) => a.annualCostUsd)
    .sort((a, b) => b - a);
  const sumTop = (n: number) =>
    sortedCosts.slice(0, n).reduce((s, c) => s + c, 0);
  const topNConcentration = {
    top3Share:
      totalAnnualCostUsd > 0 ? sumTop(3) / totalAnnualCostUsd : 0,
    top10Share:
      totalAnnualCostUsd > 0 ? sumTop(10) / totalAnnualCostUsd : 0,
  };

  // Capability coverage gap — apps with no capability mappings.
  const orphanedApps = allAppSummaries.filter(
    (a) => a.capabilityNames.length === 0
  );
  const capabilityGap = {
    unmappedAppCount: orphanedApps.length,
    unmappedAnnualCostUsd: orphanedApps.reduce(
      (s, a) => s + a.annualCostUsd,
      0
    ),
    topCostlyOrphans: orphanedApps
      .slice()
      .sort(sortByCostDesc)
      .slice(0, 5),
  };

  // Largest single-vendor concentration (for KPI tile + risk row).
  const topVendor = vendorConcentration[0];
  const vendorTopName = topVendor?.vendor ?? "—";
  const vendorTopShare =
    topVendor && totalAnnualCostUsd > 0
      ? topVendor.annualCostUsd / totalAnnualCostUsd
      : 0;

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
    phasingOut,
    sourcing,
    multiProductVendors,
    topNConcentration,
    capabilityGap,
    vendorTopName,
    vendorTopShare,
  };
}
