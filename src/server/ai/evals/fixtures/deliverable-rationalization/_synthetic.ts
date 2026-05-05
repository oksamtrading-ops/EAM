import "server-only";
import type {
  RationalizationMetrics,
  AppSummary,
} from "@/server/ai/deliverables/buildRationalizationDocx";

/**
 * Synthetic H Motors-equivalent metrics for the deliverable-path
 * eval suite. In-memory only — no DB seeding. The four LLM calls
 * (`generateExecutiveSummary`, `generateBucketNarratives`,
 * `generateKeyFindings`, `generateDeepDives`) consume facts
 * objects derived from this metrics shape, so eval fidelity is
 * preserved without spinning up a workspace.
 *
 * Mirrors the H Motors test data the user verified at the
 * BCG/$500k bar (testing-3 / final-testing-123 review). 15 apps,
 * 100% classified, mixed buckets, multi-product Siemens vendor
 * concentration, redundant Vehicle Engineering & Design
 * capability cluster.
 */

function app(
  id: string,
  name: string,
  vendor: string | null,
  cost: number,
  lifecycle: string,
  bv: string | null,
  th: string | null,
  status: string,
  caps: string[]
): AppSummary {
  return {
    id,
    name,
    vendor,
    rationalizationStatus: status,
    lifecycle,
    businessValue: bv,
    technicalHealth: th,
    annualCostUsd: cost,
    capabilityNames: caps,
  };
}

const sap = app(
  "sap",
  "SAP ECC 6.0",
  "SAP",
  8_400_000,
  "PHASING_OUT",
  "CRITICAL",
  "FAIR",
  "MIGRATE",
  ["Finance & Treasury", "Supply Chain & Logistics"]
);
const teamcenter = app(
  "tc",
  "Teamcenter PLM",
  "Siemens Digital Industries",
  6_200_000,
  "PHASING_OUT",
  "CRITICAL",
  "TH_CRITICAL",
  "MIGRATE",
  [
    "Vehicle Engineering & Design",
    "Engineering Change Management",
    "Product Lifecycle Management",
  ]
);
const halloran = app(
  "sdv",
  "Halloran SDV Platform",
  null,
  4_600_000,
  "PLANNED",
  "CRITICAL",
  "GOOD",
  "INVEST",
  [
    "OTA Update Management",
    "Telematics & Fleet Data",
    "Software & Electronics Engineering",
  ]
);
const catia = app(
  "catia",
  "CATIA V5",
  "Dassault Systèmes",
  4_100_000,
  "ACTIVE",
  "CRITICAL",
  "GOOD",
  "INVEST",
  [
    "Vehicle Engineering & Design",
    "Mechanical Engineering",
    "Software & Electronics Engineering",
  ]
);
const incontrol = app(
  "icc",
  "InControl Connected Services (legacy)",
  "In-house + Tata Communications hosting",
  3_400_000,
  "PHASING_OUT",
  "MEDIUM",
  "POOR",
  "ELIMINATE",
  ["Telematics & Fleet Data"]
);
const sfAuto = app(
  "sfa",
  "Salesforce Automotive Cloud (UK & EU)",
  "Salesforce",
  2_800_000,
  "ACTIVE",
  "HIGH",
  "EXCELLENT",
  "INVEST",
  ["Customer 360 & Loyalty", "Lead-to-Order"]
);
const solihull = app(
  "smes",
  "Solihull MES (bespoke)",
  null,
  2_300_000,
  "PHASING_OUT",
  "HIGH",
  "TH_CRITICAL",
  "MIGRATE",
  ["Plant-Floor Execution (MES)"]
);
const wirecast = app(
  "wc",
  "Wirecast",
  "Verizon Connect",
  2_100_000,
  "ACTIVE",
  "MEDIUM",
  "GOOD",
  "TOLERATE",
  []
);
const apriso = app(
  "ap",
  "Apriso MES (Halewood plant)",
  "Dassault Systèmes (DELMIA Apriso)",
  1_950_000,
  "ACTIVE",
  "CRITICAL",
  "GOOD",
  "INVEST",
  ["Paint Shop", "Plant-Floor Execution (MES)", "Manufacturing Operations"]
);
const opcenter = app(
  "oc",
  "Opcenter Execution (Nitra plant)",
  "Siemens",
  1_720_000,
  "ACTIVE",
  "CRITICAL",
  "EXCELLENT",
  "INVEST",
  ["Manufacturing Operations"]
);
const sfSales = app(
  "sfs",
  "Salesforce Sales Cloud (US)",
  "Salesforce",
  1_650_000,
  "ACTIVE",
  "HIGH",
  "GOOD",
  "TOLERATE",
  ["Customer 360 & Loyalty", "Lead-to-Order"]
);
const warranty = app(
  "war",
  "Warranty Claims (Tavant)",
  "Tavant Technologies",
  1_520_000,
  "ACTIVE",
  "HIGH",
  "GOOD",
  "TOLERATE",
  ["Warranty Claims Processing"]
);
const dynamics = app(
  "dyn",
  "Microsoft Dynamics CRM (China & APAC ex-India)",
  "Microsoft",
  1_400_000,
  "ACTIVE",
  "HIGH",
  "FAIR",
  "INVEST",
  ["Lead-to-Order"]
);
const aftersales = app(
  "as400",
  "Aftersales Parts Catalog (AS/400)",
  null,
  1_180_000,
  "PHASING_OUT",
  "HIGH",
  "TH_CRITICAL",
  "ELIMINATE",
  ["Parts Catalog & Ordering"]
);
const nx = app(
  "nx",
  "NX",
  "Siemens",
  680_000,
  "ACTIVE",
  "MEDIUM",
  "GOOD",
  "TOLERATE",
  [
    "Mechanical Engineering",
    "Engineering Change Management",
    "Product Lifecycle Management",
  ]
);

const ALL_APPS = [
  sap,
  teamcenter,
  halloran,
  catia,
  incontrol,
  sfAuto,
  solihull,
  wirecast,
  apriso,
  opcenter,
  sfSales,
  warranty,
  dynamics,
  aftersales,
  nx,
];

function bucket(status: string) {
  const apps = ALL_APPS.filter((a) => a.rationalizationStatus === status);
  return {
    count: apps.length,
    annualCostUsd: apps.reduce((s, a) => s + a.annualCostUsd, 0),
    apps,
  };
}

const capMap = new Map<string, AppSummary[]>();
for (const a of ALL_APPS) {
  for (const c of a.capabilityNames) {
    const cur = capMap.get(c) ?? [];
    cur.push(a);
    capMap.set(c, cur);
  }
}
const redundancyMatrix = Array.from(capMap.entries())
  .filter(([, apps]) => apps.length >= 2)
  .sort((a, b) => b[1].length - a[1].length)
  .map(([cap, apps]) => ({ capabilityName: cap, appsCovering: apps }));

const eliminate3 = bucket("ELIMINATE").annualCostUsd * 3;
const migrate3 = bucket("MIGRATE").annualCostUsd * 0.5 * 3;

/** Synthetic H Motors-equivalent metrics. Stable across runs.
 *  Use this as the in-memory source of truth for all four
 *  deliverable-path LLM call evals. */
export const SYNTHETIC_H_MOTORS_METRICS: RationalizationMetrics = {
  totalApps: ALL_APPS.length,
  activeApps: ALL_APPS.filter((a) => a.lifecycle === "ACTIVE").length,
  classifiedApps: ALL_APPS.length,
  coverageRatio: 1,
  byClassification: {
    TOLERATE: bucket("TOLERATE"),
    INVEST: bucket("INVEST"),
    MIGRATE: bucket("MIGRATE"),
    ELIMINATE: bucket("ELIMINATE"),
  },
  topEliminationCandidates: bucket("ELIMINATE")
    .apps.slice()
    .sort((a, b) => b.annualCostUsd - a.annualCostUsd),
  topMigrationCandidates: bucket("MIGRATE")
    .apps.slice()
    .sort((a, b) => b.annualCostUsd - a.annualCostUsd),
  redundancyMatrix,
  projectedSavings: {
    eliminate3yrUsd: eliminate3,
    migrate3yrUsd: migrate3,
    totalCandidate3yrUsd: eliminate3 + migrate3,
    assumptions: [
      "Horizon: 3 years from the report date.",
      "ELIMINATE candidates: 100% of annualCostUsd avoided over the horizon.",
      "MIGRATE candidates: 50% of annualCostUsd avoided over the horizon.",
      "Discount rate: not applied in this version.",
      "Excludes one-time decommission and migration costs.",
      "Costs reflect the values stored on each Application record at the time of generation.",
    ],
  },
  costCurrency: "GBP",
  totalAnnualCostUsd: ALL_APPS.reduce((s, a) => s + a.annualCostUsd, 0),
  topAppsByCost: ALL_APPS.slice()
    .sort((a, b) => b.annualCostUsd - a.annualCostUsd)
    .slice(0, 10),
  lifecycleDistribution: {
    PHASING_OUT: { count: 5, annualCostUsd: 21_480_000 },
    ACTIVE: { count: 9, annualCostUsd: 17_920_000 },
    PLANNED: { count: 1, annualCostUsd: 4_600_000 },
  },
  vendorConcentration: [
    { vendor: "Siemens", count: 3, annualCostUsd: 8_600_000 },
    { vendor: "SAP", count: 1, annualCostUsd: 8_400_000 },
    { vendor: "Dassault Systèmes", count: 2, annualCostUsd: 6_050_000 },
    { vendor: "Salesforce", count: 2, annualCostUsd: 4_450_000 },
    { vendor: "Verizon Connect", count: 1, annualCostUsd: 2_100_000 },
    { vendor: "Tavant Technologies", count: 1, annualCostUsd: 1_520_000 },
    { vendor: "Microsoft", count: 1, annualCostUsd: 1_400_000 },
  ],
  classifyFirst: [],
  phasingOut: {
    count: 5,
    annualCostUsd: 21_480_000,
    shareOfTotal: 0.488,
  },
  sourcing: {
    inHouse: { count: 4, annualCostUsd: 11_480_000 },
    thirdParty: { count: 11, annualCostUsd: 32_520_000 },
    inHouseShare: 0.261,
  },
  multiProductVendors: [
    {
      vendor: "Siemens",
      count: 3,
      annualCostUsd: 8_600_000,
      apps: [
        { name: teamcenter.name, capabilityNames: teamcenter.capabilityNames },
        { name: opcenter.name, capabilityNames: opcenter.capabilityNames },
        { name: nx.name, capabilityNames: nx.capabilityNames },
      ],
    },
    {
      vendor: "Dassault Systèmes",
      count: 2,
      annualCostUsd: 6_050_000,
      apps: [
        { name: catia.name, capabilityNames: catia.capabilityNames },
        { name: apriso.name, capabilityNames: apriso.capabilityNames },
      ],
    },
    {
      vendor: "Salesforce",
      count: 2,
      annualCostUsd: 4_450_000,
      apps: [
        { name: sfAuto.name, capabilityNames: sfAuto.capabilityNames },
        { name: sfSales.name, capabilityNames: sfSales.capabilityNames },
      ],
    },
  ],
  topNConcentration: { top3Share: 0.526, top10Share: 0.85 },
  capabilityGap: {
    unmappedAppCount: 1,
    unmappedAnnualCostUsd: 2_100_000,
    topCostlyOrphans: [wirecast],
  },
  vendorTopName: "Siemens",
  vendorTopShare: 0.195,
};

export const SYNTHETIC_CLIENT_NAME = "H Motors (Eval Fixture)";
