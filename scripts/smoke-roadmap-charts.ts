/* eslint-disable */
// Smoke test for the 3 architecture-roadmap chart primitives.
// Renders each into a docx, writes to /tmp for visual inspection.
import { writeFileSync } from "node:fs";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { buildGanttSwimLane } from "../src/server/ai/deliverables/charts/buildGanttSwimLane";
import { buildBenefitsCurve } from "../src/server/ai/deliverables/charts/buildBenefitsCurve";
import { buildRiskHeatmap } from "../src/server/ai/deliverables/charts/buildRiskHeatmap";

async function main() {
  const brandHex = "#5A4FCF";

  console.log("Rendering benefits curve…");
  const curve = await buildBenefitsCurve({
    points: [
      { label: "Now", cumulativeCount: 0 },
      { label: "Q2", cumulativeCount: 1 },
      { label: "End Y1", cumulativeCount: 4 },
      { label: "End Y2", cumulativeCount: 7 },
      { label: "End Y3", cumulativeCount: 9 },
    ],
    totalInitiatives: 9,
    brandHex,
  });
  console.log("  curve OK");

  console.log("Rendering risk heatmap…");
  const heatmap = await buildRiskHeatmap({
    bubbles: [
      { initiativeName: "S/4HANA Cutover", likelihood: 3, impact: 3, size: 8 },
      { initiativeName: "OTA Platform Stand-up", likelihood: 2, impact: 3, size: 6 },
      { initiativeName: "AS/400 Decommission", likelihood: 3, impact: 2, size: 4 },
      { initiativeName: "MES Modernization", likelihood: 2, impact: 2, size: 5 },
      { initiativeName: "Customer 360", likelihood: 1, impact: 2, size: 3 },
      { initiativeName: "Dealer Portal Refresh", likelihood: 1, impact: 1, size: 2 },
    ],
    brandHex,
  });
  console.log("  heatmap OK");

  console.log("Rendering Gantt swim-lane…");
  const gantt = await buildGanttSwimLane({
    waves: {
      NOW: [
        { id: "i1", name: "S/4HANA Cutover", category: "MODERNISATION", ragStatus: "AMBER" },
        { id: "i2", name: "OTA Platform Stand-up", category: "INNOVATION", ragStatus: "GREEN" },
        { id: "i3", name: "AS/400 Decommission", category: "DECOMMISSION", ragStatus: "RED" },
        { id: "i4", name: "Vehicle Cybersecurity R155", category: "COMPLIANCE", ragStatus: "AMBER" },
      ],
      NEXT: [
        { id: "i5", name: "Customer 360 Consolidation", category: "CONSOLIDATION", ragStatus: "GREEN" },
        { id: "i6", name: "MES Modernization", category: "MODERNISATION", ragStatus: "GREEN" },
        { id: "i7", name: "ECM Uplift", category: "OPTIMISATION", ragStatus: "AMBER" },
      ],
      LATER: [
        { id: "i8", name: "Connected Vehicle Expansion", category: "INNOVATION", ragStatus: "GREEN" },
        { id: "i9", name: "Dealer Portal Refresh", category: "DIGITALISATION", ragStatus: "GREEN" },
      ],
    },
    dependencies: [
      { fromId: "i1", toId: "i6" },
      { fromId: "i2", toId: "i8" },
      { fromId: "i3", toId: "i9" },
      { fromId: "i4", toId: "i2" },
    ],
    brandHex,
  });
  console.log("  gantt OK");

  const doc = new Document({
    creator: "Test",
    title: "Roadmap chart smoke",
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({ children: [new TextRun({ text: "Gantt swim-lane", bold: true })] }),
          gantt,
          new Paragraph({ children: [new TextRun({ text: "Benefits curve", bold: true })] }),
          curve,
          new Paragraph({ children: [new TextRun({ text: "Risk heatmap", bold: true })] }),
          heatmap,
        ],
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  writeFileSync("/tmp/smoke-roadmap-charts.docx", buffer);
  console.log(`OK — /tmp/smoke-roadmap-charts.docx (${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
