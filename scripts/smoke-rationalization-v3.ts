/* eslint-disable */
// Smoke test for Rationalization v3.0 — packs the doc against
// synthetic H Motors data. LLM calls fall back to deterministic
// (no API key in CLI) — confirms the fallback paths render
// without crashing. Run:
//   node --conditions=react-server --import tsx scripts/smoke-rationalization-v3.ts
import { writeFileSync } from "node:fs";
import { buildRationalizationDocx } from "../src/server/ai/deliverables/buildRationalizationDocx";
import type { RationalizationMetrics } from "../src/server/ai/deliverables/buildRationalizationDocx";

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
) {
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

const sap = app("sap", "SAP ECC 6.0", "SAP", 8_400_000, "PHASING_OUT", "CRITICAL", "FAIR", "MIGRATE", ["Finance & Treasury"]);
const teamcenter = app("tc", "Teamcenter PLM", "Siemens Digital Industries", 6_200_000, "PHASING_OUT", "CRITICAL", "TH_CRITICAL", "MIGRATE", ["Vehicle Engineering & Design", "Engineering Change Management", "Product Lifecycle Management"]);
const halloran = app("sdv", "Halloran SDV Platform", null, 4_600_000, "PLANNED", "CRITICAL", "GOOD", "INVEST", ["OTA Update Management", "Telematics & Fleet Data", "Software & Electronics Engineering"]);
const catia = app("catia", "CATIA V5", "Dassault Systèmes", 4_100_000, "ACTIVE", "CRITICAL", "GOOD", "INVEST", ["Vehicle Engineering & Design", "Mechanical Engineering", "Software & Electronics Engineering"]);
const incontrol = app("icc", "InControl Connected Services (legacy)", "In-house + Tata Communications hosting", 3_400_000, "PHASING_OUT", "MEDIUM", "POOR", "ELIMINATE", ["Telematics & Fleet Data"]);
const sfAuto = app("sfa", "Salesforce Automotive Cloud (UK & EU)", "Salesforce", 2_800_000, "ACTIVE", "HIGH", "EXCELLENT", "INVEST", ["Customer 360 & Loyalty", "Lead-to-Order", "Mobile App & Digital Channels", "Customer Experience & CRM"]);
const solihull = app("smes", "Solihull MES (bespoke)", null, 2_300_000, "PHASING_OUT", "HIGH", "TH_CRITICAL", "MIGRATE", ["Plant-Floor Execution (MES)"]);
const wirecast = app("wc", "Wirecast", "Verizon Connect", 2_100_000, "ACTIVE", "MEDIUM", "GOOD", "TOLERATE", []);
const apriso = app("ap", "Apriso MES (Halewood plant)", "Dassault Systèmes (DELMIA Apriso)", 1_950_000, "ACTIVE", "CRITICAL", "GOOD", "INVEST", ["Paint Shop", "Plant-Floor Execution (MES)", "Manufacturing Operations"]);
const opcenter = app("oc", "Opcenter Execution (Nitra plant)", "Siemens", 1_720_000, "ACTIVE", "CRITICAL", "EXCELLENT", "INVEST", ["Manufacturing Operations"]);
const sfSales = app("sfs", "Salesforce Sales Cloud (US)", "Salesforce", 1_650_000, "ACTIVE", "HIGH", "GOOD", "TOLERATE", ["Customer 360 & Loyalty", "Lead-to-Order", "Mobile App & Digital Channels", "Customer Experience & CRM"]);
const warranty = app("war", "Warranty Claims (Tavant)", "Tavant Technologies", 1_520_000, "ACTIVE", "HIGH", "GOOD", "TOLERATE", ["Warranty Claims Processing"]);
const dynamics = app("dyn", "Microsoft Dynamics CRM (China & APAC ex-India)", "Microsoft", 1_400_000, "ACTIVE", "HIGH", "FAIR", "INVEST", ["Lead-to-Order"]);
const aftersales = app("as400", "Aftersales Parts Catalog (AS/400)", null, 1_180_000, "PHASING_OUT", "HIGH", "TH_CRITICAL", "ELIMINATE", ["Parts Catalog & Ordering"]);
const nx = app("nx", "NX", "Siemens", 680_000, "ACTIVE", "MEDIUM", "GOOD", "TOLERATE", ["Mechanical Engineering", "Engineering Change Management", "Product Lifecycle Management"]);

const all = [sap, teamcenter, halloran, catia, incontrol, sfAuto, solihull, wirecast, apriso, opcenter, sfSales, warranty, dynamics, aftersales, nx];

function bucket(status: string) {
  const apps = all.filter((a) => a.rationalizationStatus === status);
  return {
    count: apps.length,
    annualCostUsd: apps.reduce((s, a) => s + a.annualCostUsd, 0),
    apps,
  };
}

// Build redundancyMatrix manually
const capMap = new Map<string, typeof all>();
for (const a of all) {
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

const metrics: RationalizationMetrics = {
  totalApps: all.length,
  activeApps: all.filter((a) => a.lifecycle === "ACTIVE").length,
  classifiedApps: all.length,
  coverageRatio: 1,
  byClassification: {
    TOLERATE: bucket("TOLERATE"),
    INVEST: bucket("INVEST"),
    MIGRATE: bucket("MIGRATE"),
    ELIMINATE: bucket("ELIMINATE"),
  },
  topEliminationCandidates: bucket("ELIMINATE").apps.slice().sort((a, b) => b.annualCostUsd - a.annualCostUsd),
  topMigrationCandidates: bucket("MIGRATE").apps.slice().sort((a, b) => b.annualCostUsd - a.annualCostUsd),
  redundancyMatrix,
  projectedSavings: {
    eliminate3yrUsd: eliminate3,
    migrate3yrUsd: migrate3,
    totalCandidate3yrUsd: eliminate3 + migrate3,
    assumptions: [
      "Horizon: 3 years from the report date.",
      "ELIMINATE candidates: 100% of annualCostUsd avoided over the horizon.",
      "MIGRATE candidates: 50% of annualCostUsd avoided over the horizon (typical SaaS swap saves roughly half on license + run-cost).",
      "Discount rate: not applied in this version (savings stated in nominal dollars).",
      "Excludes one-time decommission and migration costs — surface those separately when building a business case.",
      "Costs reflect the values stored on each Application record at the time of generation; refresh those for an up-to-date picture.",
    ],
  },
  costCurrency: "GBP",
  totalAnnualCostUsd: all.reduce((s, a) => s + a.annualCostUsd, 0),
  topAppsByCost: all.slice().sort((a, b) => b.annualCostUsd - a.annualCostUsd).slice(0, 10),
  lifecycleDistribution: {
    PHASING_OUT: { count: 5, annualCostUsd: 21_480_000 },
    ACTIVE: { count: 9, annualCostUsd: 17_920_000 },
    PLANNED: { count: 1, annualCostUsd: 4_600_000 },
  },
  vendorConcentration: [
    { vendor: "SAP", count: 1, annualCostUsd: 8_400_000 },
    { vendor: "Siemens Digital Industries", count: 1, annualCostUsd: 6_200_000 },
    { vendor: "Salesforce", count: 2, annualCostUsd: 4_450_000 },
    { vendor: "Dassault Systèmes", count: 1, annualCostUsd: 4_100_000 },
    { vendor: "Siemens", count: 2, annualCostUsd: 2_400_000 },
    { vendor: "Verizon Connect", count: 1, annualCostUsd: 2_100_000 },
    { vendor: "Dassault Systèmes (DELMIA Apriso)", count: 1, annualCostUsd: 1_950_000 },
    { vendor: "Microsoft", count: 1, annualCostUsd: 1_400_000 },
    { vendor: "Tavant Technologies", count: 1, annualCostUsd: 1_520_000 },
  ],
  classifyFirst: [],
  phasingOut: { count: 5, annualCostUsd: 21_480_000, shareOfTotal: 0.488 },
  sourcing: {
    inHouse: { count: 4, annualCostUsd: 11_480_000 },
    thirdParty: { count: 11, annualCostUsd: 32_520_000 },
    inHouseShare: 0.261,
  },
  multiProductVendors: [
    { vendor: "Siemens", count: 2, annualCostUsd: 2_400_000, apps: [opcenter, nx] },
    { vendor: "Salesforce", count: 2, annualCostUsd: 4_450_000, apps: [sfAuto, sfSales] },
  ],
  topNConcentration: { top3Share: 0.43, top10Share: 0.85 },
  capabilityGap: { unmappedAppCount: 1, unmappedAnnualCostUsd: 2_100_000, topCostlyOrphans: [wirecast] },
  vendorTopName: "SAP",
  vendorTopShare: 0.191,
};

(async () => {
  const result = await buildRationalizationDocx({
    clientName: "H Motors v3 Smoke",
    brandHex: "#7C3AED",
    preparedBy: "Samuel Owusu",
    engagementCode: "HMOTORS-2026-05",
    contactLine: "samuel.owusu@example.com",
    metrics,
  });
  const path = "/tmp/h-motors-v3-smoke.docx";
  writeFileSync(path, result.buffer);
  console.log(`✓ wrote ${result.buffer.length} bytes → ${path}`);
  console.log(`  template: ${result.templateVersion}`);
  console.log(`  llmSource: ${result.llmSource}`);
})().catch((err) => {
  console.error("✗ smoke test failed:", err);
  process.exit(1);
});
