/* eslint-disable */
// Smoke test for the 3 maturity chart primitives. Renders each
// to PNG, writes to /tmp for visual inspection.
import { writeFileSync } from "node:fs";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { buildImportanceMaturityMatrix } from "../src/server/ai/deliverables/charts/buildImportanceMaturityMatrix";
import { buildCriticalMaturityBar } from "../src/server/ai/deliverables/charts/buildCriticalMaturityBar";
import { buildL1MaturityHeatmap } from "../src/server/ai/deliverables/charts/buildL1MaturityHeatmap";

const brandHex = "7C3AED";

(async () => {
  // 1. Importance × maturity matrix
  const matrixCells = [
    { importance: "CRITICAL", maturity: "INITIAL", count: 2, topCapabilities: ["Vehicle Engineering & Design"] },
    { importance: "CRITICAL", maturity: "DEVELOPING", count: 3, topCapabilities: ["OTA Update Management"] },
    { importance: "CRITICAL", maturity: "DEFINED", count: 4, topCapabilities: ["Manufacturing Operations"] },
    { importance: "CRITICAL", maturity: "MANAGED", count: 1, topCapabilities: ["Finance & Treasury"] },
    { importance: "HIGH", maturity: "DEVELOPING", count: 5, topCapabilities: ["Customer 360 & Loyalty"] },
    { importance: "HIGH", maturity: "DEFINED", count: 3, topCapabilities: ["Lead-to-Order"] },
    { importance: "HIGH", maturity: "MANAGED", count: 2 },
    { importance: "MEDIUM", maturity: "DEVELOPING", count: 4 },
    { importance: "MEDIUM", maturity: "DEFINED", count: 6 },
    { importance: "LOW", maturity: "MANAGED", count: 2 },
    { importance: "LOW", maturity: "OPTIMIZING", count: 1, topCapabilities: ["Internal Reporting"] },
    { importance: "NOT_ASSESSED", maturity: "NOT_ASSESSED", count: 8 },
  ];

  // 2. CRITICAL maturity bar (synthesis hero)
  const criticalCaps = [
    { name: "Vehicle Engineering & Design", currentMaturity: "INITIAL", targetMaturity: "MANAGED", appCount: 3 },
    { name: "OTA Update Management", currentMaturity: "DEVELOPING", targetMaturity: "OPTIMIZING", appCount: 1 },
    { name: "Manufacturing Operations", currentMaturity: "DEFINED", targetMaturity: "MANAGED", appCount: 2 },
    { name: "Plant-Floor Execution (MES)", currentMaturity: "DEVELOPING", targetMaturity: "MANAGED", appCount: 2 },
    { name: "Finance & Treasury", currentMaturity: "MANAGED", targetMaturity: "MANAGED", appCount: 1 },
    { name: "Vehicle Cybersecurity (R155/R156)", currentMaturity: "INITIAL", targetMaturity: "DEFINED", appCount: 1 },
  ];

  // 3. L1 maturity heatmap
  const l1Rows = [
    {
      l1Name: "Engineering & Product Development",
      byMaturity: { INITIAL: 2, DEVELOPING: 4, DEFINED: 3, MANAGED: 1, OPTIMIZING: 0 },
      currentMean: 2.3,
      targetMean: 4.0,
      totalChildren: 10,
    },
    {
      l1Name: "Manufacturing & Operations",
      byMaturity: { INITIAL: 1, DEVELOPING: 3, DEFINED: 4, MANAGED: 2, OPTIMIZING: 0 },
      currentMean: 2.7,
      targetMean: 3.8,
      totalChildren: 10,
    },
    {
      l1Name: "Customer & Sales",
      byMaturity: { INITIAL: 0, DEVELOPING: 2, DEFINED: 5, MANAGED: 2, OPTIMIZING: 1 },
      currentMean: 3.2,
      targetMean: 4.2,
      totalChildren: 10,
    },
    {
      l1Name: "Connected Vehicle & SDV",
      byMaturity: { INITIAL: 3, DEVELOPING: 2, DEFINED: 1, MANAGED: 0, OPTIMIZING: 0 },
      currentMean: 1.7,
      targetMean: 4.5,
      totalChildren: 6,
    },
    {
      l1Name: "Finance & Corporate",
      byMaturity: { INITIAL: 0, DEVELOPING: 0, DEFINED: 2, MANAGED: 4, OPTIMIZING: 0 },
      currentMean: 3.7,
      targetMean: 4.0,
      totalChildren: 6,
    },
  ];

  console.log("Rendering matrix…");
  const matrix = await buildImportanceMaturityMatrix({
    cells: matrixCells,
    brandHex,
  });

  console.log("Rendering critical-bar…");
  const bar = await buildCriticalMaturityBar({
    capabilities: criticalCaps,
    brandHex,
  });

  console.log("Rendering L1 heatmap…");
  const heatmap = await buildL1MaturityHeatmap({
    rows: l1Rows,
    brandHex,
  });

  const doc = new Document({
    creator: "Smoke",
    title: "Maturity Charts Smoke",
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({ children: [new TextRun({ text: "1. Importance × Maturity Matrix", bold: true, size: 28 })] }),
          matrix,
          new Paragraph({ children: [new TextRun({ text: "2. CRITICAL Capabilities — Synthesis Hero", bold: true, size: 28 })] }),
          bar,
          new Paragraph({ children: [new TextRun({ text: "3. L1 Maturity Heatmap", bold: true, size: 28 })] }),
          heatmap,
        ],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  const path = "/tmp/maturity-charts-smoke.docx";
  writeFileSync(path, buf);
  console.log(`✓ wrote ${buf.length} bytes → ${path}`);
})().catch((err) => {
  console.error("✗", err);
  process.exit(1);
});
