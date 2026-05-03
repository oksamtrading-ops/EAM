/* eslint-disable */
// Smoke test: runs buildPortfolioSnapshotReport with Halloran-like
// synthetic data and writes the docx to disk. Run with:
//   npx tsx scripts/smoke-snapshot.ts
// Reads no DB, no LLM. Pure deterministic builder check.
import { writeFileSync } from "node:fs";
import { buildPortfolioSnapshotReport } from "../src/server/ai/deliverables/buildPortfolioSnapshotReport";
import type { RationalizationMetrics } from "../src/server/ai/deliverables/buildRationalizationDocx";

const halloran: RationalizationMetrics = {
  totalApps: 15,
  activeApps: 9,
  classifiedApps: 0,
  coverageRatio: 0,
  byClassification: {
    TOLERATE: { count: 0, annualCostUsd: 0, apps: [] },
    INVEST: { count: 0, annualCostUsd: 0, apps: [] },
    MIGRATE: { count: 0, annualCostUsd: 0, apps: [] },
    ELIMINATE: { count: 0, annualCostUsd: 0, apps: [] },
  },
  topEliminationCandidates: [],
  topMigrationCandidates: [],
  redundancyMatrix: [],
  projectedSavings: {
    eliminate3yrUsd: 0,
    migrate3yrUsd: 0,
    totalCandidate3yrUsd: 0,
    assumptions: [],
  },
  costCurrency: "GBP",
  totalAnnualCostUsd: 44_000_000,
  topAppsByCost: [
    app("SAP ECC 6.0", "SAP", 8_400_000, "PHASING_OUT", ["ERP"]),
    app("Teamcenter PLM", "Siemens Digital Industries", 6_200_000, "PHASING_OUT", ["PLM"]),
    app("Halloran SDV Platform", "In-house (AWS)", 4_600_000, "PLANNED", []),
    app("CATIA V5", "Dassault Systèmes", 4_100_000, "ACTIVE", ["Engineering CAD"]),
    app("InControl Connected Services (legacy)", "In-house + Tata Communications hosting", 3_400_000, "PHASING_OUT", []),
    app("Salesforce Automotive Cloud (UK & EU)", "Salesforce", 2_800_000, "ACTIVE", ["CRM"]),
    app("Solihull MES (bespoke)", "In-house", 2_300_000, "PHASING_OUT", ["MES"]),
    app("Wirecast", "Verizon Connect", 2_100_000, "ACTIVE", []),
    app("Apriso MES (Halewood plant)", "Dassault Systèmes (DELMIA Apriso)", 1_950_000, "ACTIVE", ["MES"]),
    app("Opcenter Execution (Nitra plant)", "Siemens", 1_720_000, "ACTIVE", ["MES"]),
  ],
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
  ],
  classifyFirst: [
    { ...app("SAP ECC 6.0", "SAP", 8_400_000, "PHASING_OUT", ["ERP"]), reason: "Active retirement candidate — disposition decision overdue." },
    { ...app("Teamcenter PLM", "Siemens Digital Industries", 6_200_000, "PHASING_OUT", ["PLM"]), reason: "Active retirement candidate — disposition decision overdue." },
    { ...app("InControl Connected Services (legacy)", "In-house + Tata Communications hosting", 3_400_000, "PHASING_OUT", []), reason: "Active retirement candidate — disposition decision overdue." },
    { ...app("Solihull MES (bespoke)", "In-house", 2_300_000, "PHASING_OUT", ["MES"]), reason: "Active retirement candidate — disposition decision overdue." },
    { ...app("Halloran SDV Platform", "In-house (AWS)", 4_600_000, "PLANNED", []), reason: "High annual cost — classify to surface savings or investment." },
  ],
  phasingOut: { count: 5, annualCostUsd: 21_480_000, shareOfTotal: 0.488 },
  sourcing: {
    inHouse: { count: 3, annualCostUsd: 10_300_000 },
    thirdParty: { count: 12, annualCostUsd: 33_700_000 },
    inHouseShare: 0.234,
  },
  multiProductVendors: [
    { vendor: "Salesforce", count: 2, annualCostUsd: 4_450_000, apps: [{ name: "Salesforce Automotive Cloud (UK & EU)", capabilityNames: ["CRM"] }, { name: "Salesforce CPQ", capabilityNames: ["CPQ"] }] },
    { vendor: "Siemens", count: 2, annualCostUsd: 2_400_000, apps: [{ name: "Opcenter Execution (Nitra plant)", capabilityNames: ["MES"] }, { name: "Opcenter APS", capabilityNames: ["MES", "Planning"] }] },
  ],
  topNConcentration: { top3Share: 0.43, top10Share: 0.85 },
  capabilityGap: {
    unmappedAppCount: 3,
    unmappedAnnualCostUsd: 10_100_000,
    topCostlyOrphans: [
      app("Halloran SDV Platform", "In-house (AWS)", 4_600_000, "PLANNED", []),
      app("InControl Connected Services (legacy)", "In-house + Tata Communications hosting", 3_400_000, "PHASING_OUT", []),
      app("Wirecast", "Verizon Connect", 2_100_000, "ACTIVE", []),
    ],
  },
  vendorTopName: "SAP",
  vendorTopShare: 0.191,
};

function app(name: string, vendor: string, cost: number, lifecycle: string, caps: string[]) {
  return {
    id: name,
    name,
    vendor,
    rationalizationStatus: null,
    lifecycle,
    businessValue: null,
    technicalHealth: null,
    annualCostUsd: cost,
    capabilityNames: caps,
  };
}

(async () => {
  const result = await buildPortfolioSnapshotReport({
    clientName: "Halloran Motor Company",
    brandHex: "#7C3AED",
    preparedBy: "Samuel Owusu",
    engagementCode: "HALLORAN-2026-05",
    contactLine: "samuel.owusu@example.com",
    metrics: halloran,
  });
  const path = "/tmp/halloran-snapshot-v2.docx";
  writeFileSync(path, result.buffer);
  console.log(`✓ wrote ${result.buffer.length} bytes → ${path}`);
  console.log(`  template: ${result.templateVersion}`);
  console.log(`  llmSource: ${result.llmSource}`);
})().catch((err) => {
  console.error("✗ smoke test failed:", err);
  process.exit(1);
});
