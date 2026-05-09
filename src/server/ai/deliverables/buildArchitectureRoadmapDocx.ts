import "server-only";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
} from "docx";
import { anthropic } from "@/server/ai/client";
import { MODEL_SONNET } from "@/server/ai/models";
import {
  ARCHITECTURE_ROADMAP_EXEC_SUMMARY_PROMPT,
  ARCHITECTURE_ROADMAP_EXEC_SUMMARY_VERSION,
} from "@/server/ai/prompts/architectureRoadmapExecSummary.v1";
import {
  ARCHITECTURE_ROADMAP_KEY_FINDINGS_PROMPT,
  ARCHITECTURE_ROADMAP_KEY_FINDINGS_VERSION,
} from "@/server/ai/prompts/architectureRoadmapKeyFindings.v1";
import {
  ARCHITECTURE_ROADMAP_WAVE_NARRATIVES_PROMPT,
  ARCHITECTURE_ROADMAP_WAVE_NARRATIVES_VERSION,
} from "@/server/ai/prompts/architectureRoadmapWaveNarratives.v1";
import {
  ARCHITECTURE_ROADMAP_INITIATIVE_DEEP_DIVES_PROMPT,
  ARCHITECTURE_ROADMAP_INITIATIVE_DEEP_DIVES_VERSION,
} from "@/server/ai/prompts/architectureRoadmapInitiativeDeepDives.v1";
import {
  buildActionTitle,
  buildHeading,
  buildCallout,
  buildKpiRow,
  buildStaticTOC,
  buildStatusPillCell,
  buildTable,
  clampForContrast,
  makeFooter,
  normalizeHex,
  renderCoverPage,
  renderInline,
  renderInsideCoverDisclaimer,
  renderSectionDivider,
} from "./_helpers";
import {
  runDeliverableLLMCalls,
  type AggregateSource,
} from "./_orchestrator";
import { verifyMaturityNumbers } from "./_factCheck";
import { T, type Tone } from "./tokens";
import type {
  ArchitectureRoadmapMetrics,
  InitiativeWithWeight,
  WaveBlock,
  WaveLabel,
} from "./architectureRoadmapMetrics";
import { collectAllowedRoadmapCounts } from "./architectureRoadmapMetrics";
import { buildGanttSwimLane } from "./charts/buildGanttSwimLane";
import { buildBenefitsCurve } from "./charts/buildBenefitsCurve";
import { buildRiskHeatmap, type RiskBubble } from "./charts/buildRiskHeatmap";

export const ARCHITECTURE_ROADMAP_TEMPLATE_VERSION = "1.0";
export const ARCHITECTURE_ROADMAP_TEMPLATE_LABEL = `EAM Architecture Roadmap Template v${ARCHITECTURE_ROADMAP_TEMPLATE_VERSION}`;
export const ARCHITECTURE_ROADMAP_PROJECT_LABEL = "Architecture Roadmap";

export type ArchitectureRoadmapDocxInput = {
  clientName: string;
  brandHex: string | null;
  preparedBy?: string | null;
  engagementCode?: string | null;
  contactLine?: string | null;
  metrics: ArchitectureRoadmapMetrics;
};

export type ArchitectureRoadmapDocxResult = {
  buffer: Buffer;
  templateVersion: string;
  llmSource: AggregateSource;
  llmSourceDetail: string;
};

// ─── LLM call result shapes ───────────────────────────────────

type ExecSummaryResult = { text: string };
type KeyFinding = { title: string; body: string };
type KeyFindingsResult = { findings: KeyFinding[] };

type WaveNarrative = {
  governingThought: string;
  whyNow: string[];
  whatItMeans: string;
  counterfactual: string;
  action: string;
};
type AllWaveNarratives = {
  NOW: WaveNarrative;
  NEXT: WaveNarrative;
  LATER: WaveNarrative;
};
type WaveNarrativesResult = { narratives: AllWaveNarratives };

type DeepDive = {
  dispositionRationale: string;
  recommendedPath: string;
  riskProfile: string;
  waveJustification: string;
};
type DeepDivesResult = { byId: Record<string, DeepDive> };

// ─── Main builder ─────────────────────────────────────────────

export async function buildArchitectureRoadmapDocx(
  input: ArchitectureRoadmapDocxInput
): Promise<ArchitectureRoadmapDocxResult> {
  const brandHex = normalizeHex(input.brandHex);
  const m = input.metrics;
  const today = new Date().toISOString().slice(0, 10);

  // Top-7 initiatives for deep-dive section
  const topInitiatives = m.topInitiativesByImpact.slice(0, 7);

  const execFacts = buildExecSummaryFacts(m, input.clientName);
  const keyFindingsFacts = buildKeyFindingsFacts(m, input.clientName);
  const waveNarrativesFacts = buildWaveNarrativesFacts(m, input.clientName);
  const deepDivesFacts = buildDeepDivesFacts(topInitiatives, input.clientName);
  const allowedCounts = collectAllowedRoadmapCounts(m);

  // ─── Parallel LLM calls + chart renders ──────────────────────

  const [llmOut, ganttChart, benefitsCurveChart, riskHeatmapChart] =
    await Promise.all([
      runDeliverableLLMCalls<{
        execSummary: ExecSummaryResult;
        keyFindings: KeyFindingsResult;
        waveNarratives: WaveNarrativesResult;
        deepDives: DeepDivesResult;
      }>({
        execSummary: () => generateExecSummary(execFacts, allowedCounts, m, input.clientName),
        keyFindings: () => generateKeyFindings(keyFindingsFacts, allowedCounts, m),
        waveNarratives: () => generateWaveNarratives(waveNarrativesFacts, allowedCounts, m),
        deepDives: () => generateDeepDives(deepDivesFacts, topInitiatives, allowedCounts),
      }),
      buildGanttSwimLane({
        waves: {
          NOW: m.waves.NOW.initiatives.map((i) => ({
            id: i.id,
            name: i.name,
            category: i.category,
            ragStatus: i.ragStatus,
          })),
          NEXT: m.waves.NEXT.initiatives.map((i) => ({
            id: i.id,
            name: i.name,
            category: i.category,
            ragStatus: i.ragStatus,
          })),
          LATER: m.waves.LATER.initiatives.map((i) => ({
            id: i.id,
            name: i.name,
            category: i.category,
            ragStatus: i.ragStatus,
          })),
        },
        dependencies: m.allInitiatives.flatMap((i) =>
          i.dependsOn.map((d) => ({ fromId: d.initiativeId, toId: i.id }))
        ),
        brandHex,
      }).catch((err) => {
        console.warn(JSON.stringify({ evt: "chart_render_error", chart: "gantt_swim_lane", message: String(err) }));
        return null;
      }),
      buildBenefitsCurve({
        points: buildBenefitsPoints(m),
        totalInitiatives: m.totalInitiatives,
        brandHex,
      }).catch((err) => {
        console.warn(JSON.stringify({ evt: "chart_render_error", chart: "benefits_curve", message: String(err) }));
        return null;
      }),
      buildRiskHeatmap({
        bubbles: buildRiskBubbles(m),
        brandHex,
      }).catch((err) => {
        console.warn(JSON.stringify({ evt: "chart_render_error", chart: "risk_heatmap", message: String(err) }));
        return null;
      }),
    ]);

  const { results, aggregateSource, sourceDetail } = llmOut;
  const execSummaryText = results.execSummary.text;
  const keyFindings = results.keyFindings.findings;
  const waveNarratives = results.waveNarratives.narratives;
  const deepDives = results.deepDives.byId;

  const children: (Paragraph | Table)[] = [];

  // Cover
  children.push(
    ...renderCoverPage({
      documentTitle: "Architecture Roadmap",
      clientName: input.clientName,
      brandHex,
      templateVersionLabel: ARCHITECTURE_ROADMAP_TEMPLATE_LABEL,
      preparedBy: input.preparedBy ?? null,
      logoBytes: null,
      logoMimeType: null,
      engagementCode: input.engagementCode ?? null,
      contactLine: input.contactLine ?? null,
      confidentialityLabel: `Strictly Confidential — Prepared for ${input.clientName}`,
    })
  );

  // Inside-cover disclaimer
  children.push(
    ...renderInsideCoverDisclaimer({
      clientName: input.clientName,
      date: today,
      brandHex,
    })
  );

  // Static TOC
  children.push(
    ...buildStaticTOC({
      brandHex,
      entries: [
        { title: "1. Synthesis", pageNumber: 4, indent: 0 },
        { title: "Roadmap at a Glance", pageNumber: 4, indent: 1 },
        { title: "NOW / NEXT / LATER swim-lane", pageNumber: 5, indent: 1 },
        { title: "Five Key Findings", pageNumber: 6, indent: 1 },
        { title: "Wave Dashboard", pageNumber: 7, indent: 1 },
        { title: "2. Current State", pageNumber: 8, indent: 0 },
        { title: "Executive Summary", pageNumber: 8, indent: 1 },
        { title: "Initiative Inventory", pageNumber: 9, indent: 1 },
        { title: "Dependency Network", pageNumber: 10, indent: 1 },
        { title: "Cross-Deliverable Coverage", pageNumber: 11, indent: 1 },
        { title: "3. Wave Plans", pageNumber: 12, indent: 0 },
        { title: "NOW (<12 months)", pageNumber: 12, indent: 1 },
        { title: "NEXT (12–24 months)", pageNumber: 13, indent: 1 },
        { title: "LATER (24–36 months)", pageNumber: 14, indent: 1 },
        { title: "4. Initiative Deep Dives", pageNumber: 15, indent: 0 },
        { title: "5. Roadmap & Risks", pageNumber: 22, indent: 0 },
        { title: "Benefits Delivery Curve", pageNumber: 22, indent: 1 },
        { title: "Risk Heatmap", pageNumber: 23, indent: 1 },
        { title: "Risks & Considerations", pageNumber: 24, indent: 1 },
        { title: "Next Steps", pageNumber: 25, indent: 1 },
        { title: "6. Appendices", pageNumber: 26, indent: 0 },
        { title: "Appendix A — Initiative Listing", pageNumber: 26, indent: 1 },
        { title: "Appendix B — Methodology & Data Sources", pageNumber: 27, indent: 1 },
        { title: "Appendix C — Glossary", pageNumber: 28, indent: 1 },
      ],
    })
  );

  // ═══ 1. SYNTHESIS ═══════════════════════════════════════════
  children.push(
    ...renderSectionDivider({
      number: "1",
      title: "Synthesis",
      subtitle:
        "The headline initiative count, the Wave-1 anchor, the dependency keystones, and the recommended sequencing — answered before the analysis begins.",
      brandHex,
    })
  );

  const nowCount = m.waves.NOW.count;
  const nextCount = m.waves.NEXT.count;
  const laterCount = m.waves.LATER.count;
  const keystone = m.dependencyNetwork.keystoneInitiatives[0];
  const fullBridgePct = Math.round(m.crossDeliverableCoverage.fullBridgeShare * 100);

  // Roadmap at a Glance — KPI hero row
  children.push(
    buildHeading("Roadmap at a Glance", HeadingLevel.HEADING_1, brandHex, {
      spacingBefore: 0,
    })
  );
  children.push(
    buildActionTitle(
      `${m.totalInitiatives} initiatives sequenced across NOW / NEXT / LATER waves; ${m.dependencyNetwork.edgeCount} dependency edges anchor the sequencing logic with ${keystone?.name ?? "no single keystone"} carrying the highest in-degree.`,
      brandHex
    )
  );
  children.push(
    buildKpiRow({
      brandHex,
      tiles: [
        { value: String(m.totalInitiatives), label: "Total initiatives" },
        { value: String(nowCount), label: "NOW (<12mo)" },
        { value: String(nextCount), label: "NEXT (12–24mo)" },
        { value: String(laterCount), label: "LATER (24–36mo)" },
        { value: String(m.dependencyNetwork.edgeCount), label: "Dependency edges" },
        { value: `${fullBridgePct}%`, label: "Full cross-deliverable bridge" },
      ],
    })
  );

  // Gantt swim-lane chart (THE hero)
  if (ganttChart) children.push(ganttChart);

  // Five Key Findings
  children.push(
    buildHeading("Five Key Findings", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    buildActionTitle(
      `Five findings frame the engagement; each leads with the answer and closes with the recommended sequence.`,
      brandHex
    )
  );
  for (let i = 0; i < keyFindings.length; i++) {
    const f = keyFindings[i]!;
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 60 },
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, size: T.body }),
          new TextRun({
            text: f.title,
            bold: true,
            color: clampForContrast({ hex: brandHex }),
            size: T.body,
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 160, line: 320 },
        children: renderInline(f.body),
      })
    );
  }

  // Wave Dashboard
  children.push(
    buildHeading("Wave Dashboard", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    buildActionTitle(
      "The wave breakdown at a glance: which initiatives anchor each wave, the dependency-edge load, and the RAG mix.",
      brandHex
    )
  );
  children.push(buildWaveDashboard(m, brandHex));

  children.push(
    sectionCloser(
      `${nowCount} NOW-wave initiative${nowCount === 1 ? "" : "s"} anchor the timing; ${keystone?.name ?? "the keystone initiative"} concentration anchors the dependency logic; the cross-deliverable bridge fires at ${fullBridgePct}% coverage.`,
      brandHex
    )
  );

  // ═══ 2. CURRENT STATE ═══════════════════════════════════════
  children.push(
    ...renderSectionDivider({
      number: "2",
      title: "Current State",
      subtitle:
        "How the roadmap looks today: initiative inventory, dependency network density, and cross-deliverable coverage with the rationalization + maturity outputs.",
      brandHex,
    })
  );

  // Executive Summary (LLM)
  children.push(
    buildHeading("Executive Summary", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    buildActionTitle(
      `${m.totalInitiatives} initiatives across ${Object.keys(m.byCategory).length} categories; ${nowCount} require Wave-1 commit on a forced FY-budget timeline.`,
      brandHex
    )
  );
  for (const para of execSummaryText.split(/\n\n+/).filter(Boolean)) {
    children.push(
      new Paragraph({
        spacing: { after: 160, line: 320 },
        children: renderInline(para),
      })
    );
  }

  // Initiative Inventory — by category + status
  children.push(
    buildHeading("Initiative Inventory", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    buildActionTitle(
      `${m.totalInitiatives} active initiatives span ${Object.keys(m.byCategory).length} categories; the ${dominantCategory(m)} cohort carries the heaviest weight in the current portfolio.`,
      brandHex
    )
  );
  children.push(buildInventoryTable(m, brandHex));

  // Dependency Network
  children.push(
    buildHeading("Dependency Network", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    buildActionTitle(
      `${m.dependencyNetwork.edgeCount} dependency edge${m.dependencyNetwork.edgeCount === 1 ? "" : "s"} link${m.dependencyNetwork.edgeCount === 1 ? "s" : ""} the initiatives; ${m.dependencyNetwork.connectedCount} of ${m.totalInitiatives} initiatives sit in the connected sub-graph and ${m.dependencyNetwork.isolatedCount} are isolated.`,
      brandHex
    )
  );
  children.push(buildKeystoneTable(m, brandHex));

  // Cross-Deliverable Coverage
  pushCrossDeliverableCoverage(children, m, brandHex);

  children.push(
    sectionCloser(
      `Initiative inventory plus dependency density plus cross-deliverable coverage frame the three axes of the roadmap; the wave-plan sections below sequence the actions.`,
      brandHex
    )
  );

  // ═══ 3. WAVE PLANS ══════════════════════════════════════════
  children.push(
    ...renderSectionDivider({
      number: "3",
      title: "Wave Plans",
      subtitle:
        "Each wave carries its own governing thought, evidence, sequencing implication, counterfactual, and recommended action.",
      brandHex,
    })
  );

  pushWaveSection(children, "NOW (<12 months)", waveNarratives.NOW, m.waves.NOW, brandHex);
  pushWaveSection(children, "NEXT (12–24 months)", waveNarratives.NEXT, m.waves.NEXT, brandHex);
  pushWaveSection(children, "LATER (24–36 months)", waveNarratives.LATER, m.waves.LATER, brandHex);

  children.push(
    sectionCloser(
      `Each wave carries its own clock; the deep dives below extend the case for the top-priority initiatives individually.`,
      brandHex
    )
  );

  // ═══ 4. INITIATIVE DEEP DIVES ═══════════════════════════════
  if (topInitiatives.length > 0) {
    children.push(
      ...renderSectionDivider({
        number: "4",
        title: "Initiative Deep Dives",
        subtitle:
          "Top-priority initiatives by composite priority weight. Disposition rationale, cross-deliverable bridge, recommended path, risk profile, wave assignment.",
        brandHex,
      })
    );

    for (const init of topInitiatives) {
      pushInitiativeDeepDive(
        children,
        init,
        deepDives[init.id] ?? null,
        brandHex
      );
    }

    children.push(
      sectionCloser(
        `Top-priority initiatives carry the programme's substance; the recommendations below sequence the timing, risks, and execution scaffolding.`,
        brandHex
      )
    );
  }

  // ═══ 5. ROADMAP & RISKS ═════════════════════════════════════
  children.push(
    ...renderSectionDivider({
      number: "5",
      title: "Roadmap & Risks",
      subtitle: "Benefits delivery curve, risk heatmap, watch-list, and the first thirty days of execution.",
      brandHex,
    })
  );

  children.push(buildHeading("Benefits Delivery Curve", HeadingLevel.HEADING_1, brandHex));
  children.push(
    buildActionTitle(
      `Cumulative initiative-completion pace shows the value-delivery curve over the 3-year horizon; ${nowCount} land${nowCount === 1 ? "s" : ""} in Year 1.`,
      brandHex
    )
  );
  if (benefitsCurveChart) children.push(benefitsCurveChart);

  children.push(buildHeading("Risk Heatmap", HeadingLevel.HEADING_1, brandHex));
  children.push(
    buildActionTitle(
      `Likelihood × impact across initiatives surfaces the priority watch-list; bubble size reflects capability + application impact count.`,
      brandHex
    )
  );
  if (riskHeatmapChart) children.push(riskHeatmapChart);

  // Risks & Considerations
  pushRisksSection(children, m, brandHex);

  // Next Steps
  pushNextStepsSection(children, m, brandHex);

  children.push(
    sectionCloser(
      `The roadmap dates the work; the risks frame the gating events; the next-30-day actions kick the programme off.`,
      brandHex
    )
  );

  // ═══ 6. APPENDICES ══════════════════════════════════════════
  children.push(
    ...renderSectionDivider({
      number: "6",
      title: "Appendices",
      subtitle: "Full initiative listing, methodology, and glossary of the framework terminology.",
      brandHex,
    })
  );
  pushAppendixA(children, m, brandHex);
  pushAppendixB(children, brandHex, today);
  children.push(
    buildHeading("Appendix C — Glossary", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(buildGlossaryTable(brandHex));

  // ─── Build doc ────────────────────────────────────────────
  const doc = new Document({
    creator: input.clientName,
    title: `${input.clientName} — Architecture Roadmap`,
    description: ARCHITECTURE_ROADMAP_TEMPLATE_LABEL,
    sections: [
      {
        properties: {},
        children: children as never,
        footers: {
          default: makeFooter(
            input.clientName,
            ARCHITECTURE_ROADMAP_PROJECT_LABEL
          ),
        },
      },
    ],
    styles: {
      default: { document: { run: { size: T.body, font: "Calibri" } } },
    },
  });

  const buffer = await Packer.toBuffer(doc);
  return {
    buffer: Buffer.from(buffer),
    templateVersion: ARCHITECTURE_ROADMAP_TEMPLATE_VERSION,
    llmSource: aggregateSource,
    llmSourceDetail: sourceDetail,
  };
}

// ═══ Section helpers ═══════════════════════════════════════════

function sectionCloser(text: string, brandHex: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 240, line: 320 },
    children: [
      new TextRun({
        text,
        italics: true,
        color: clampForContrast({ hex: brandHex }),
        size: T.actionTitle,
      }),
    ],
  });
}

function dominantCategory(m: ArchitectureRoadmapMetrics): string {
  const entries = Object.entries(m.byCategory);
  entries.sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  return top ? top[0].replace(/_/g, " ") : "primary";
}

function buildWaveDashboard(
  m: ArchitectureRoadmapMetrics,
  brandHex: string
): Table {
  const headers = ["Wave", "Initiatives", "Dependency edges", "Top initiative", "RAG mix"];
  const rows: Array<{
    wave: WaveLabel;
    block: WaveBlock;
    waveTone: Tone;
  }> = [
    { wave: "NOW", block: m.waves.NOW, waveTone: "danger" },
    { wave: "NEXT", block: m.waves.NEXT, waveTone: "warn" },
    { wave: "LATER", block: m.waves.LATER, waveTone: "info" },
  ];

  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const headerBorder = { style: BorderStyle.SINGLE, size: 12, color: brandHex };
  const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" };

  const headerRow = new TableRow({
    children: headers.map(
      (h, i) =>
        new TableCell({
          width: { size: [12, 16, 16, 36, 20][i]!, type: WidthType.PERCENTAGE },
          shading: { fill: "FFFFFF" },
          borders: { top: noBorder, bottom: headerBorder, left: noBorder, right: noBorder },
          children: [
            new Paragraph({
              spacing: { before: 60, after: 60 },
              children: [
                new TextRun({
                  text: h.toUpperCase(),
                  bold: true,
                  size: 18,
                  color: clampForContrast({ hex: brandHex }),
                }),
              ],
            }),
          ],
        })
    ),
  });

  const bodyRows = rows.map(
    (r) =>
      new TableRow({
        children: [
          buildStatusPillCell({ text: r.wave, tone: r.waveTone }),
          plainCell(String(r.block.count), { alignment: AlignmentType.RIGHT, widthPct: 16 }),
          plainCell(String(r.block.dependencyEdges), { alignment: AlignmentType.RIGHT, widthPct: 16 }),
          plainCell(r.block.topInitiatives[0] ?? "—", { widthPct: 36 }),
          plainCell(formatRagMix(r.block), { widthPct: 20 }),
        ],
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });
}

function formatRagMix(b: WaveBlock): string {
  const parts: string[] = [];
  if (b.ragMix.GREEN > 0) parts.push(`${b.ragMix.GREEN}G`);
  if (b.ragMix.AMBER > 0) parts.push(`${b.ragMix.AMBER}A`);
  if (b.ragMix.RED > 0) parts.push(`${b.ragMix.RED}R`);
  return parts.length > 0 ? parts.join(" / ") : "—";
}

function plainCell(
  text: string,
  opts: {
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    widthPct?: number;
  } = {}
): TableCell {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" };
  return new TableCell({
    width: opts.widthPct ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: { fill: "FFFFFF" },
    borders: {
      top: noBorder,
      bottom: cellBorder,
      left: noBorder,
      right: noBorder,
    },
    children: [
      new Paragraph({
        alignment: opts.alignment ?? AlignmentType.LEFT,
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text, size: T.body })],
      }),
    ],
  });
}

function buildInventoryTable(
  m: ArchitectureRoadmapMetrics,
  brandHex: string
): Table {
  const categoryRows = Object.entries(m.byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => [cat.replace(/_/g, " "), String(count)]);
  const statusRows = Object.entries(m.byStatus)
    .sort((a, b) => b[1] - a[1])
    .map(([s, count]) => [s.replace(/_/g, " "), String(count)]);
  return buildTable({
    headers: ["Dimension", "Value", "Count"],
    rows: [
      ...categoryRows.map((r) => ["Category", r[0]!, r[1]!]),
      ...statusRows.map((r) => ["Status", r[0]!, r[1]!]),
    ],
    brandHex,
  });
}

function buildKeystoneTable(
  m: ArchitectureRoadmapMetrics,
  brandHex: string
): Table {
  if (m.dependencyNetwork.keystoneInitiatives.length === 0) {
    return buildTable({
      headers: ["Initiative", "In-degree", "Note"],
      rows: [["—", "—", "No dependency edges in the current portfolio."]],
      brandHex,
    });
  }
  return buildTable({
    headers: ["Initiative", "In-degree", "Note"],
    rows: m.dependencyNetwork.keystoneInitiatives.map((k) => [
      k.name,
      String(k.inDegree),
      k.inDegree >= 3
        ? "Keystone — slipping cascades downstream"
        : "Sequencing-relevant",
    ]),
    brandHex,
  });
}

function pushCrossDeliverableCoverage(
  children: Array<Paragraph | Table>,
  m: ArchitectureRoadmapMetrics,
  brandHex: string
): void {
  children.push(
    buildHeading(
      "Cross-Deliverable Coverage",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );
  const appPct = Math.round(m.crossDeliverableCoverage.appLinkedShare * 100);
  const capPct = Math.round(m.crossDeliverableCoverage.capabilityLinkedShare * 100);
  const fullPct = Math.round(m.crossDeliverableCoverage.fullBridgeShare * 100);
  children.push(
    buildActionTitle(
      `${fullPct}% of initiatives carry the full cross-deliverable bridge (linked apps + linked capabilities); ${appPct}% link applications and ${capPct}% link capabilities.`,
      brandHex
    )
  );

  // Show top 5 initiatives with full bridge populated
  const fullBridge = m.allInitiatives.filter(
    (i) => i.appsLinkedCount > 0 && i.capabilitiesLinkedCount > 0
  );
  if (fullBridge.length > 0) {
    children.push(
      buildTable({
        headers: ["Initiative", "Linked apps + TIME disposition", "Linked capabilities + progression"],
        rows: fullBridge.slice(0, 8).map((i) => [
          i.name,
          i.appsLinked
            .slice(0, 2)
            .map((a) => `${a.name} [${a.rationalizationStatus ?? "—"}]`)
            .join("; ") + (i.appsLinked.length > 2 ? `, +${i.appsLinked.length - 2} more` : ""),
          i.capabilitiesLinked
            .slice(0, 2)
            .map((c) => `${c.name} (${c.currentMaturity.replace(/_/g, " ")} → ${c.targetMaturity.replace(/_/g, " ")})`)
            .join("; ") + (i.capabilitiesLinked.length > 2 ? `, +${i.capabilitiesLinked.length - 2} more` : ""),
        ]),
        brandHex,
      })
    );
  } else {
    children.push(
      buildCallout({
        title: "No full cross-deliverable bridge populated",
        tone: "warn",
        bullets: [
          `${m.totalInitiatives} initiative${m.totalInitiatives === 1 ? "" : "s"} on the roadmap; none carry both linked apps and linked capabilities.`,
          "The platform's cross-deliverable bridge activates when an initiative maps to applications (rationalization) AND capabilities (maturity).",
          "Map at least the priority initiatives to both axes before the next portfolio review.",
        ],
        brandHex,
      })
    );
  }
}

function pushWaveSection(
  children: Array<Paragraph | Table>,
  title: string,
  narrative: WaveNarrative,
  block: WaveBlock,
  brandHex: string
): void {
  children.push(buildHeading(title, HeadingLevel.HEADING_1, brandHex));

  if (block.count === 0) {
    children.push(
      buildCallout({
        title: "No initiatives in this wave",
        tone: "info",
        bullets: ["Initiatives matching this wave will populate this section in future runs."],
        brandHex,
      })
    );
    return;
  }

  const top2 = block.initiatives.slice(0, 2).map((i) => i.name);
  children.push(
    buildActionTitle(
      `${block.count} initiative${block.count === 1 ? "" : "s"} sequenced in ${title.split(" ")[0]} (${top2.join(" and ")}); ${block.dependencyEdges} dependency edge${block.dependencyEdges === 1 ? "" : "s"} originate${block.dependencyEdges === 1 ? "s" : ""} from this wave.`,
      brandHex
    )
  );

  // Governing thought
  children.push(
    new Paragraph({
      spacing: { after: 160, line: 320 },
      children: [
        new TextRun({ text: narrative.governingThought, bold: true, size: 24 }),
      ],
    })
  );

  // Why now
  children.push(
    new Paragraph({
      spacing: { before: 80, after: 80 },
      children: [
        new TextRun({
          text: "Why now",
          bold: true,
          color: clampForContrast({ hex: brandHex }),
          size: 22,
        }),
      ],
    })
  );
  for (const bullet of narrative.whyNow) {
    if (!bullet || bullet.trim() === "—") continue;
    children.push(
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60, line: 320 },
        children: renderInline(bullet),
      })
    );
  }

  // What it means
  children.push(
    new Paragraph({
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: "What it means",
          bold: true,
          color: clampForContrast({ hex: brandHex }),
          size: 22,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 160, line: 320 },
      children: renderInline(narrative.whatItMeans),
    })
  );

  // Counterfactual (suppressed for empty)
  if (
    narrative.counterfactual &&
    narrative.counterfactual.trim() !== "—" &&
    narrative.counterfactual.trim().length > 0
  ) {
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 80 },
        children: [
          new TextRun({
            text: "If this wave slips",
            bold: true,
            color: clampForContrast({ hex: brandHex }),
            size: 22,
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 160, line: 320 },
        children: [
          new TextRun({
            text: narrative.counterfactual,
            italics: true,
            size: 22,
          }),
        ],
      })
    );
  }

  // Recommended action
  children.push(
    new Paragraph({
      spacing: { before: 80, after: 80 },
      children: [
        new TextRun({
          text: "Recommended action",
          bold: true,
          color: clampForContrast({ hex: brandHex }),
          size: 22,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 200, line: 320 },
      children: [new TextRun({ text: narrative.action, italics: true, size: 22 })],
    })
  );

  // Wave initiatives table
  children.push(buildWaveInitiativesTable(block.initiatives, brandHex));
}

function buildWaveInitiativesTable(
  initiatives: InitiativeWithWeight[],
  brandHex: string
): Table {
  return buildTable({
    headers: [
      "Initiative",
      "Category",
      "Priority",
      "RAG",
      "Apps mapped",
      "Capabilities mapped",
      "Dependencies",
    ],
    rows: initiatives.map((i) => [
      i.name,
      i.category.replace(/_/g, " "),
      i.priority,
      i.ragStatus,
      String(i.appsLinkedCount),
      String(i.capabilitiesLinkedCount),
      String(i.dependsOn.length),
    ]),
    brandHex,
  });
}

function pushInitiativeDeepDive(
  children: Array<Paragraph | Table>,
  init: InitiativeWithWeight,
  dive: DeepDive | null,
  brandHex: string
): void {
  children.push(buildHeading(init.name, HeadingLevel.HEADING_1, brandHex));
  children.push(
    buildActionTitle(
      `${init.priority} priority, wave ${init.wave}, RAG ${init.ragStatus}; ${init.appsLinkedCount} app${init.appsLinkedCount === 1 ? "" : "s"} mapped, ${init.capabilitiesLinkedCount} capabilit${init.capabilitiesLinkedCount === 1 ? "y" : "ies"} mapped, ${init.dependsOn.length + init.blocking.length} dependency edge${init.dependsOn.length + init.blocking.length === 1 ? "" : "s"}.`,
      brandHex
    )
  );

  // Hero KPI tile row
  children.push(
    buildKpiRow({
      brandHex,
      tiles: [
        { value: init.priority, label: "Priority" },
        { value: init.wave, label: "Wave" },
        { value: init.ragStatus, label: "RAG status" },
        { value: `${init.progressPct}%`, label: "Progress" },
        { value: String(init.appsLinkedCount), label: "Apps linked" },
        { value: String(init.capabilitiesLinkedCount), label: "Capabilities linked" },
      ],
    })
  );

  // Linked applications (cross-deliverable bridge)
  if (init.appsLinked.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: "Linked applications (rationalization bridge)",
            bold: true,
            color: clampForContrast({ hex: brandHex }),
            size: T.body,
          }),
        ],
      })
    );
    for (const a of init.appsLinked) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 40 },
          children: [
            new TextRun({ text: a.name, size: T.body, bold: true }),
            new TextRun({
              text: ` — disposition: ${a.rationalizationStatus ?? "UNCLASSIFIED"} (${a.lifecycle.replace(/_/g, " ")})`,
              size: T.body,
              color: "4B5563",
            }),
          ],
        })
      );
    }
  }

  // Linked capabilities (cross-deliverable bridge)
  if (init.capabilitiesLinked.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 80 },
        children: [
          new TextRun({
            text: "Linked capabilities (maturity bridge)",
            bold: true,
            color: clampForContrast({ hex: brandHex }),
            size: T.body,
          }),
        ],
      })
    );
    for (const c of init.capabilitiesLinked) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 40 },
          children: [
            new TextRun({ text: c.name, size: T.body, bold: true }),
            new TextRun({
              text: ` — ${c.l1Name} domain, ${c.strategicImportance.replace(/_/g, " ")} importance, ${c.currentMaturity.replace(/_/g, " ")} → ${c.targetMaturity.replace(/_/g, " ")}`,
              size: T.body,
              color: "4B5563",
            }),
          ],
        })
      );
    }
  }

  // Dependency edges
  if (init.dependsOn.length > 0 || init.blocking.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 80 },
        children: [
          new TextRun({
            text: "Dependency edges",
            bold: true,
            color: clampForContrast({ hex: brandHex }),
            size: T.body,
          }),
        ],
      })
    );
    for (const d of init.dependsOn) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 40 },
          children: [
            new TextRun({ text: "Depends on: ", size: T.body, color: "6B7280" }),
            new TextRun({ text: d.initiativeName, size: T.body, bold: true }),
          ],
        })
      );
    }
    for (const d of init.blocking) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 40 },
          children: [
            new TextRun({ text: "Blocks: ", size: T.body, color: "6B7280" }),
            new TextRun({ text: d.initiativeName, size: T.body, bold: true }),
          ],
        })
      );
    }
  }

  // LLM-grounded prose
  if (dive) {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: "Disposition rationale",
            bold: true,
            color: clampForContrast({ hex: brandHex }),
            size: T.body,
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 160, line: 320 },
        children: renderInline(dive.dispositionRationale),
      })
    );

    children.push(
      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [
          new TextRun({
            text: "Recommended path",
            bold: true,
            color: clampForContrast({ hex: brandHex }),
            size: T.body,
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 160, line: 320 },
        children: renderInline(dive.recommendedPath),
      })
    );

    if (dive.riskProfile && dive.riskProfile.trim().length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 80 },
          children: [
            new TextRun({
              text: "Risk profile",
              bold: true,
              color: clampForContrast({ hex: brandHex }),
              size: T.body,
            }),
          ],
        })
      );
      children.push(
        new Paragraph({
          spacing: { after: 160, line: 320 },
          children: renderInline(dive.riskProfile),
        })
      );
    }

    children.push(
      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [
          new TextRun({
            text: "Wave",
            bold: true,
            color: clampForContrast({ hex: brandHex }),
            size: T.body,
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 240, line: 320 },
        children: [new TextRun({ text: dive.waveJustification, italics: true, size: T.body })],
      })
    );
  }
}

function pushRisksSection(
  children: Array<Paragraph | Table>,
  m: ArchitectureRoadmapMetrics,
  brandHex: string
): void {
  children.push(buildHeading("Risks & Considerations", HeadingLevel.HEADING_1, brandHex));

  const portfolioRisks: string[][] = [];
  const ws = m.workspaceSpecificRisks;

  if (ws.wave1WithoutOwner.count > 0) {
    portfolioRisks.push([
      `${ws.wave1WithoutOwner.count} NOW-wave initiative${ws.wave1WithoutOwner.count === 1 ? "" : "s"} lack${ws.wave1WithoutOwner.count === 1 ? "s" : ""} an owner (${ws.wave1WithoutOwner.initiatives.slice(0, 2).join(", ")}${ws.wave1WithoutOwner.initiatives.length > 2 ? ", …" : ""})`,
      "H",
      "H",
      "Assign owners to every Wave-1 initiative before FY budget commit; ownership is the first gate the wave walks through.",
    ]);
  }
  if (ws.redRagInitiatives.count > 0) {
    portfolioRisks.push([
      `${ws.redRagInitiatives.count} initiative${ws.redRagInitiatives.count === 1 ? "" : "s"} at RED RAG status (${ws.redRagInitiatives.initiatives.slice(0, 2).join(", ")}${ws.redRagInitiatives.initiatives.length > 2 ? ", …" : ""})`,
      "H",
      "H",
      "Steerco review the RED-RAG cohort weekly; surface root-cause + recovery plan; rebaseline timeline if scope inflation drove the slip.",
    ]);
  }
  if (ws.orphanedInitiatives.count > 0) {
    portfolioRisks.push([
      `${ws.orphanedInitiatives.count} initiative${ws.orphanedInitiatives.count === 1 ? "" : "s"} sit orphaned (no linked apps + no linked capabilities)`,
      "M",
      "H",
      "Anchor each orphaned initiative against a named capability or application before commit; confirm strategic value before allocating capacity.",
    ]);
  }
  if (ws.blockedByIncomplete.count > 0) {
    portfolioRisks.push([
      `${ws.blockedByIncomplete.count} initiative${ws.blockedByIncomplete.count === 1 ? "" : "s"} blocked by incomplete upstream work`,
      "M",
      "H",
      "Sequence after upstream completion; protect against cascade-slip; load-test the dependency map.",
    ]);
  }

  const allRows = [
    ...portfolioRisks,
    [
      "Cross-wave dependency cascade — keystone slip propagates downstream",
      "M",
      "H",
      "Track keystone initiatives weekly; protect the dependency map; gate wave handoffs on keystone completion.",
    ],
    [
      "Capability + application mapping drift between deliverable regenerations",
      "L",
      "M",
      "Re-run the rationalization + maturity deliverables quarterly; the cross-deliverable bridge regenerates from live data on each pass.",
    ],
    [
      "Resource contention across initiatives competing for the same engineering capacity",
      "M",
      "M",
      "Capacity-leveling exercise pre-Wave-1 commit; CTO + COO co-validate the budget against headcount.",
    ],
    [
      "Cancelled or deprioritized initiatives leaving capability gaps unfilled",
      "L",
      "M",
      "When CANCELLED, redirect the underlying capability gap to a successor initiative; no silent abandonment.",
    ],
    [
      "Vendor-event exposure on linked applications during initiative execution",
      "M",
      "M",
      "Map every linked application's vendor renewal date; sequence initiative phases around vendor commercial cycles.",
    ],
  ];

  children.push(
    buildActionTitle(
      `${portfolioRisks.length} portfolio-specific risk${portfolioRisks.length === 1 ? "" : "s"} sit above the canonical 5; cross-wave cascade, mapping drift, and resource contention frame the watch-list.`,
      brandHex
    )
  );
  children.push(
    buildTable({
      headers: ["Risk", "Likelihood", "Impact", "Mitigation"],
      rows: allRows,
      brandHex,
    })
  );
}

function pushNextStepsSection(
  children: Array<Paragraph | Table>,
  m: ArchitectureRoadmapMetrics,
  brandHex: string
): void {
  children.push(buildHeading("Next Steps", HeadingLevel.HEADING_1, brandHex));
  children.push(
    new Paragraph({
      spacing: { after: 160, line: 320 },
      children: [
        new TextRun({
          text: "Over the next 30 days, ",
          bold: true,
          color: clampForContrast({ hex: brandHex }),
          size: T.body,
        }),
        new TextRun({
          text: `initiative owners validate the ${m.waves.NOW.count} Wave-1 commitment${m.waves.NOW.count === 1 ? "" : "s"} against the dependency map and confirm the keystone sequence. The architecture team load-tests the cross-deliverable bridge before any FY budget commit. Steerco approval gates the start of Wave-1 execution by Week 12.`,
          size: T.body,
        }),
      ],
    })
  );
  children.push(
    buildTable({
      headers: ["Action", "Owner", "Due", "Dependency"],
      rows: [
        [
          `Validate the ${m.waves.NOW.count} NOW-wave initiatives with capability + application owners`,
          "[Architecture Lead]",
          "Week 2",
          "Capability + application maps",
        ],
        [
          "Confirm dependency edges + keystone identification",
          "[Programme Lead]",
          "Week 3",
          "Dependency network up-to-date",
        ],
        [
          `Assign owners to ${m.workspaceSpecificRisks.wave1WithoutOwner.count} Wave-1 initiative${m.workspaceSpecificRisks.wave1WithoutOwner.count === 1 ? "" : "s"} without an owner`,
          "[Programme Sponsor]",
          "Week 4",
          "Owner availability",
        ],
        [
          `Steerco review of RED-RAG cohort (${m.workspaceSpecificRisks.redRagInitiatives.count} initiative${m.workspaceSpecificRisks.redRagInitiatives.count === 1 ? "" : "s"})`,
          "[Steerco Chair]",
          "Week 6",
          "Recovery plans for each",
        ],
        [
          "Steerco review of the wave sequencing roadmap",
          "[Programme Sponsor]",
          "Week 8",
          "Above artefacts complete",
        ],
        [
          "Anchor orphaned initiatives against named capabilities or applications",
          "[Architecture Lead]",
          "Week 10",
          "Cross-deliverable bridge complete",
        ],
      ],
      brandHex,
    })
  );
}

function pushAppendixA(
  children: Array<Paragraph | Table>,
  m: ArchitectureRoadmapMetrics,
  brandHex: string
): void {
  children.push(
    buildHeading("Appendix A — Initiative Listing", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    buildTable({
      headers: [
        "Initiative",
        "Category",
        "Wave",
        "Priority",
        "RAG",
        "Apps",
        "Caps",
        "Deps",
      ],
      rows: m.allInitiatives.map((i) => [
        i.name,
        i.category.replace(/_/g, " "),
        i.wave,
        i.priority,
        i.ragStatus,
        String(i.appsLinkedCount),
        String(i.capabilitiesLinkedCount),
        String(i.dependsOn.length),
      ]),
      brandHex,
    })
  );
}

function pushAppendixB(
  children: Array<Paragraph | Table>,
  brandHex: string,
  today: string
): void {
  children.push(
    buildHeading(
      "Appendix B — Methodology & Data Sources",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );
  children.push(
    new Paragraph({
      spacing: { after: 160, line: 320 },
      children: [
        new TextRun({
          text: `This deliverable was generated on ${today} from the live initiative portfolio in the EAM platform. Counts and dependency edges reflect the values stored on each Initiative record at the time of generation; the source fields are `,
          size: T.body,
        }),
        new TextRun({ text: "horizon", italics: true, size: T.body }),
        new TextRun({ text: ", ", size: T.body }),
        new TextRun({ text: "ragStatus", italics: true, size: T.body }),
        new TextRun({ text: ", ", size: T.body }),
        new TextRun({ text: "priority", italics: true, size: T.body }),
        new TextRun({ text: ", ", size: T.body }),
        new TextRun({ text: "category", italics: true, size: T.body }),
        new TextRun({ text: ", ", size: T.body }),
        new TextRun({ text: "InitiativeApplicationMap", italics: true, size: T.body }),
        new TextRun({ text: ", ", size: T.body }),
        new TextRun({ text: "InitiativeCapabilityMap", italics: true, size: T.body }),
        new TextRun({ text: ", and ", size: T.body }),
        new TextRun({ text: "InitiativeDependency", italics: true, size: T.body }),
        new TextRun({ text: ".", size: T.body }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 160, line: 320 },
      children: [
        new TextRun({ text: "Wave heuristic.", bold: true, size: T.body }),
        new TextRun({
          text: " H1_NOW → NOW (<12mo); H2_NEXT → NEXT (12-24mo); H3_LATER and BEYOND collapse to LATER (24-36mo). Cross-wave dependency edges drive sequencing risk; the keystone initiative is the one with highest in-degree.",
          size: T.body,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 160, line: 320 },
      children: [
        new TextRun({ text: "Top-N selection (deep dives).", bold: true, size: T.body }),
        new TextRun({
          text: " Composite priorityWeight = priorityScore × (1 + dependencyDegree × 0.5) × log(1 + capabilityImpact + appImpact). Priority weights: CRITICAL=4, HIGH=3, MEDIUM=2, LOW=1.",
          size: T.body,
        }),
      ],
    })
  );
  children.push(
    buildCallout({
      title: "What this deliverable is not",
      tone: "info",
      brandHex,
      bullets: [
        "Not an investment-cost case. The deliverable's currency is initiative count × wave × dependency coverage; per-initiative budgets are not aggregated in v1. Cost rolls in at v2 once Initiative.budgetUsd density is validated across real workspaces.",
        "Not a project plan. Milestones and granular timelines are out of scope; the roadmap sequences action at the wave level.",
        "Not a peer benchmark. No external comparator data exists in the schema.",
        "Not a resource-leveling exercise. The wave heuristic is deterministic, not optimized for capacity contention.",
      ],
    })
  );
}

function buildGlossaryTable(brandHex: string): Table {
  return buildTable({
    headers: ["Term", "Definition"],
    rows: [
      [
        "Wave",
        "NOW (<12mo) / NEXT (12-24mo) / LATER (24-36mo). Maps to Initiative.horizon; BEYOND collapses to LATER for v1.",
      ],
      [
        "Dependency edge",
        "Directed edge from blocking initiative to dependent initiative. In-degree = number of initiatives blocked by this one.",
      ],
      [
        "Keystone initiative",
        "Initiative with the highest in-degree; sequencing-critical because slip propagates downstream.",
      ],
      [
        "Cross-deliverable bridge",
        "Bridge to the Application Rationalization Plan (linked apps + TIME dispositions) AND the Capability Maturity Assessment (linked capabilities + maturity progression). Full bridge = both sides populated.",
      ],
      [
        "RAG status",
        "GREEN / AMBER / RED traffic-light health rating on each initiative. RED = active concern; AMBER = monitor; GREEN = on track.",
      ],
      [
        "Composite priority weight",
        "priorityScore × (1 + dependencyDegree × 0.5) × log(1 + capabilityImpact + appImpact). Used to rank deep-dive candidates.",
      ],
      [
        "Initiative category",
        "MODERNISATION / CONSOLIDATION / DIGITALISATION / COMPLIANCE / OPTIMISATION / INNOVATION / DECOMMISSION.",
      ],
    ],
    brandHex,
  });
}

// ─── Helpers for chart inputs ─────────────────────────────────

function buildBenefitsPoints(
  m: ArchitectureRoadmapMetrics
): Array<{ label: string; cumulativeCount: number }> {
  // Cumulative completion curve. Uses status.COMPLETE counts when
  // present; otherwise projects expected completion against waves.
  const completedNow = m.allInitiatives.filter((i) => i.status === "COMPLETE").length;
  return [
    { label: "Now", cumulativeCount: completedNow },
    {
      label: "End Y1",
      cumulativeCount: completedNow + Math.round(m.waves.NOW.count * 0.7),
    },
    {
      label: "End Y2",
      cumulativeCount:
        completedNow + m.waves.NOW.count + Math.round(m.waves.NEXT.count * 0.7),
    },
    {
      label: "End Y3",
      cumulativeCount:
        completedNow +
        m.waves.NOW.count +
        m.waves.NEXT.count +
        Math.round(m.waves.LATER.count * 0.7),
    },
  ];
}

function buildRiskBubbles(m: ArchitectureRoadmapMetrics): RiskBubble[] {
  // Heuristic: likelihood = derived from RAG status; impact = derived
  // from priority + dependency in-degree. Size = capability + app
  // impact count.
  return m.allInitiatives.slice(0, 12).map((i) => {
    let likelihood: 1 | 2 | 3 = 1;
    if (i.ragStatus === "AMBER") likelihood = 2;
    else if (i.ragStatus === "RED") likelihood = 3;

    const inDeg = i.blocking.length;
    let impact: 1 | 2 | 3 = 1;
    if (i.priority === "HIGH" || inDeg >= 1) impact = 2;
    if (i.priority === "CRITICAL" || inDeg >= 3) impact = 3;

    const size = i.capabilitiesLinkedCount + i.appsLinkedCount;
    return {
      initiativeName: i.name,
      likelihood,
      impact,
      size,
    };
  });
}

// ─── Facts builders for LLM calls ─────────────────────────────

type ExecSummaryFacts = {
  clientName: string;
  totalInitiatives: number;
  byCategoryCounts: Record<string, number>;
  waves: { NOW: number; NEXT: number; LATER: number };
  ragMix: Record<string, number>;
  dependencyEdges: number;
  keystone: { name: string; inDegree: number } | null;
  isolated: number;
  fullBridgePct: number;
  appLinkedPct: number;
  capabilityLinkedPct: number;
  topInitiatives: Array<{
    name: string;
    wave: WaveLabel;
    priority: string;
    category: string;
    ragStatus: string;
    appsLinked: Array<{ name: string; rationalizationStatus: string | null; lifecycle: string }>;
    capabilitiesLinked: Array<{ name: string; l1Name: string; current: string; target: string }>;
  }>;
  workspaceRisks: {
    wave1WithoutOwner: number;
    redRag: number;
    orphaned: number;
    blockedByIncomplete: number;
  };
};

export function buildExecSummaryFacts(
  m: ArchitectureRoadmapMetrics,
  clientName: string
): ExecSummaryFacts {
  return {
    clientName,
    totalInitiatives: m.totalInitiatives,
    byCategoryCounts: m.byCategory,
    waves: { NOW: m.waves.NOW.count, NEXT: m.waves.NEXT.count, LATER: m.waves.LATER.count },
    ragMix: m.byRagStatus,
    dependencyEdges: m.dependencyNetwork.edgeCount,
    keystone: m.dependencyNetwork.keystoneInitiatives[0]
      ? {
          name: m.dependencyNetwork.keystoneInitiatives[0]!.name,
          inDegree: m.dependencyNetwork.keystoneInitiatives[0]!.inDegree,
        }
      : null,
    isolated: m.dependencyNetwork.isolatedCount,
    fullBridgePct: Math.round(m.crossDeliverableCoverage.fullBridgeShare * 100),
    appLinkedPct: Math.round(m.crossDeliverableCoverage.appLinkedShare * 100),
    capabilityLinkedPct: Math.round(m.crossDeliverableCoverage.capabilityLinkedShare * 100),
    topInitiatives: m.topInitiativesByImpact.slice(0, 5).map((i) => ({
      name: i.name,
      wave: i.wave,
      priority: i.priority,
      category: i.category,
      ragStatus: i.ragStatus,
      appsLinked: i.appsLinked.map((a) => ({
        name: a.name,
        rationalizationStatus: a.rationalizationStatus,
        lifecycle: a.lifecycle,
      })),
      capabilitiesLinked: i.capabilitiesLinked.map((c) => ({
        name: c.name,
        l1Name: c.l1Name,
        current: c.currentMaturity,
        target: c.targetMaturity,
      })),
    })),
    workspaceRisks: {
      wave1WithoutOwner: m.workspaceSpecificRisks.wave1WithoutOwner.count,
      redRag: m.workspaceSpecificRisks.redRagInitiatives.count,
      orphaned: m.workspaceSpecificRisks.orphanedInitiatives.count,
      blockedByIncomplete: m.workspaceSpecificRisks.blockedByIncomplete.count,
    },
  };
}

type KeyFindingsFacts = ExecSummaryFacts & {
  keystones: Array<{ name: string; inDegree: number }>;
};

export function buildKeyFindingsFacts(
  m: ArchitectureRoadmapMetrics,
  clientName: string
): KeyFindingsFacts {
  return {
    ...buildExecSummaryFacts(m, clientName),
    keystones: m.dependencyNetwork.keystoneInitiatives.slice(0, 3),
  };
}

type WaveFactsBlock = {
  count: number;
  cumulativeDependencyEdges: number;
  ragMix: Record<string, number>;
  topInitiatives: Array<{
    name: string;
    priority: string;
    ragStatus: string;
    appsLinkedCount: number;
    capabilitiesLinkedCount: number;
    dependencyEdges: number;
  }>;
};

type WaveNarrativesFacts = {
  clientName: string;
  waves: {
    NOW: WaveFactsBlock;
    NEXT: WaveFactsBlock;
    LATER: WaveFactsBlock;
  };
  crossWaveDependencies: number;
};

export function buildWaveNarrativesFacts(
  m: ArchitectureRoadmapMetrics,
  clientName: string
): WaveNarrativesFacts {
  const blockOf = (block: WaveBlock): WaveFactsBlock => ({
    count: block.count,
    cumulativeDependencyEdges: block.dependencyEdges,
    ragMix: block.ragMix,
    topInitiatives: block.initiatives.slice(0, 5).map((i) => ({
      name: i.name,
      priority: i.priority,
      ragStatus: i.ragStatus,
      appsLinkedCount: i.appsLinkedCount,
      capabilitiesLinkedCount: i.capabilitiesLinkedCount,
      dependencyEdges: i.dependsOn.length + i.blocking.length,
    })),
  });

  // Cross-wave dependency edges: initiatives in NEXT/LATER that depend on NOW/NEXT
  let crossWave = 0;
  const initWave = new Map(m.allInitiatives.map((i) => [i.id, i.wave]));
  for (const i of m.allInitiatives) {
    for (const e of i.dependsOn) {
      const fromWave = initWave.get(e.initiativeId);
      if (fromWave && fromWave !== i.wave) crossWave++;
    }
  }

  return {
    clientName,
    waves: {
      NOW: blockOf(m.waves.NOW),
      NEXT: blockOf(m.waves.NEXT),
      LATER: blockOf(m.waves.LATER),
    },
    crossWaveDependencies: crossWave,
  };
}

type DeepDivesFacts = {
  clientName: string;
  initiatives: Array<{
    id: string;
    name: string;
    description: string | null;
    category: string;
    status: string;
    priority: string;
    horizon: string;
    wave: string;
    ragStatus: string;
    progressPct: number;
    hasOwner: boolean;
    appsLinked: Array<{ name: string; rationalizationStatus: string | null; lifecycle: string }>;
    capabilitiesLinked: Array<{
      name: string;
      l1Name: string;
      strategicImportance: string;
      currentMaturity: string;
      targetMaturity: string;
    }>;
    dependsOn: Array<{ name: string }>;
    blocking: Array<{ name: string }>;
    inDegree: number;
  }>;
};

export function buildDeepDivesFacts(
  initiatives: InitiativeWithWeight[],
  clientName: string
): DeepDivesFacts {
  return {
    clientName,
    initiatives: initiatives.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      category: i.category,
      status: i.status,
      priority: i.priority,
      horizon: i.horizon,
      wave: i.wave,
      ragStatus: i.ragStatus,
      progressPct: i.progressPct,
      hasOwner: i.hasOwner,
      appsLinked: i.appsLinked,
      capabilitiesLinked: i.capabilitiesLinked.map((c) => ({
        name: c.name,
        l1Name: c.l1Name,
        strategicImportance: c.strategicImportance,
        currentMaturity: c.currentMaturity,
        targetMaturity: c.targetMaturity,
      })),
      dependsOn: i.dependsOn.map((d) => ({ name: d.initiativeName })),
      blocking: i.blocking.map((d) => ({ name: d.initiativeName })),
      inDegree: i.blocking.length,
    })),
  };
}

// ─── LLM call wrappers (with deterministic fallback) ─────────

export async function generateExecSummary(
  facts: ExecSummaryFacts,
  allowedCounts: number[],
  m: ArchitectureRoadmapMetrics,
  _clientName: string
): Promise<{ source: "llm" | "deterministic_fallback"; result: ExecSummaryResult }> {
  if (facts.totalInitiatives === 0) {
    return {
      source: "deterministic_fallback",
      result: { text: deterministicExecFallback(facts) },
    };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL_SONNET,
        max_tokens: 2400,
        system: ARCHITECTURE_ROADMAP_EXEC_SUMMARY_PROMPT,
        messages: [
          { role: "user", content: `Facts:\n${JSON.stringify(facts, null, 2)}\n\nReturn JSON only.` },
        ],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      const raw = textBlock && "text" in textBlock ? (textBlock.text as string) : "";
      const parsed = parseJsonish(raw) as { executiveSummary?: string };
      const text = parsed.executiveSummary;
      if (!text || typeof text !== "string" || text.length < 200) continue;
      if (!verifyMaturityNumbers(text, allowedCounts)) {
        console.warn(JSON.stringify({ evt: "roadmap_exec_fact_mismatch", attempt }));
        continue;
      }
      return { source: "llm", result: { text } };
    } catch (err) {
      console.warn(JSON.stringify({ evt: "roadmap_exec_llm_error", attempt, message: String(err) }));
    }
  }
  return {
    source: "deterministic_fallback",
    result: { text: deterministicExecFallback(facts) },
  };
  void m;
}

function deterministicExecFallback(facts: ExecSummaryFacts): string {
  const lines: string[] = [];
  lines.push(
    `Findings indicate the ${facts.clientName} architecture portfolio comprises ${facts.totalInitiatives} active initiative${facts.totalInitiatives === 1 ? "" : "s"} across ${Object.keys(facts.byCategoryCounts).length} categories. Wave 1 carries ${facts.waves.NOW} initiative${facts.waves.NOW === 1 ? "" : "s"}, Wave 2 carries ${facts.waves.NEXT}, and the long-horizon trajectory adds ${facts.waves.LATER}. The dependency network spans ${facts.dependencyEdges} edge${facts.dependencyEdges === 1 ? "" : "s"}; ${facts.keystone ? `${facts.keystone.name} anchors the network with ${facts.keystone.inDegree} downstream initiative${facts.keystone.inDegree === 1 ? "" : "s"} depending on it` : "no single keystone dominates the dependency graph"}.`
  );
  const top = facts.topInitiatives[0];
  lines.push(
    `${facts.fullBridgePct}% of initiatives carry the full cross-deliverable bridge (linked applications and linked capabilities); ${facts.appLinkedPct}% reference the rationalization output and ${facts.capabilityLinkedPct}% reference the maturity output. ${top ? `${top.name} anchors the priority cohort: ${top.appsLinked.length > 0 ? `linked to ${top.appsLinked[0]!.name} [${top.appsLinked[0]!.rationalizationStatus ?? "UNCLASSIFIED"}]` : "no application linked yet"}; ${top.capabilitiesLinked.length > 0 ? `lifts ${top.capabilitiesLinked[0]!.name} from ${top.capabilitiesLinked[0]!.current.replace(/_/g, " ")} to ${top.capabilitiesLinked[0]!.target.replace(/_/g, " ")}` : "no capability progression yet mapped"}.` : ""} The risk-watch list carries ${facts.workspaceRisks.wave1WithoutOwner} Wave-1 initiative${facts.workspaceRisks.wave1WithoutOwner === 1 ? "" : "s"} without an owner and ${facts.workspaceRisks.redRag} initiative${facts.workspaceRisks.redRag === 1 ? "" : "s"} at RED RAG status.`
  );
  lines.push(
    `Wave 1 sequencing follows dependency readiness, not just priority: keystone-blocked initiatives default to NEXT until upstream completion. The Roadmap & Risks chapter sequences the priority lift across NOW / NEXT / LATER waves; the Initiative Deep Dives extend the case for the top ${Math.min(7, facts.totalInitiatives)} initiative${Math.min(7, facts.totalInitiatives) === 1 ? "" : "s"} by composite priority weight.`
  );
  return lines.join("\n\n");
}

export async function generateKeyFindings(
  facts: KeyFindingsFacts,
  allowedCounts: number[],
  m: ArchitectureRoadmapMetrics
): Promise<{ source: "llm" | "deterministic_fallback"; result: KeyFindingsResult }> {
  if (facts.totalInitiatives === 0) {
    return {
      source: "deterministic_fallback",
      result: { findings: deterministicKeyFindingsFallback(facts) },
    };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL_SONNET,
        max_tokens: 3000,
        system: ARCHITECTURE_ROADMAP_KEY_FINDINGS_PROMPT,
        messages: [
          { role: "user", content: `Facts:\n${JSON.stringify(facts, null, 2)}\n\nReturn JSON only.` },
        ],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      const raw = textBlock && "text" in textBlock ? (textBlock.text as string) : "";
      const parsed = parseJsonish(raw) as { findings?: KeyFinding[] };
      const findings = (parsed.findings ?? [])
        .filter((f): f is KeyFinding => typeof f.title === "string" && typeof f.body === "string")
        .slice(0, 5);
      if (findings.length < 3) continue;
      const allText = findings.map((f) => `${f.title} ${f.body}`).join(" ");
      if (!verifyMaturityNumbers(allText, allowedCounts)) {
        console.warn(JSON.stringify({ evt: "roadmap_findings_fact_mismatch", attempt }));
        continue;
      }
      // Pad to 5 from deterministic fallback when LLM emits fewer
      if (findings.length < 5) {
        const fallback = deterministicKeyFindingsFallback(facts);
        const seen = new Set(findings.map((f) => f.title));
        for (const f of fallback) {
          if (findings.length >= 5) break;
          if (!seen.has(f.title)) findings.push(f);
        }
      }
      return { source: "llm", result: { findings } };
    } catch (err) {
      console.warn(JSON.stringify({ evt: "roadmap_findings_llm_error", attempt, message: String(err) }));
    }
  }
  return {
    source: "deterministic_fallback",
    result: { findings: deterministicKeyFindingsFallback(facts) },
  };
  void m;
}

function deterministicKeyFindingsFallback(facts: KeyFindingsFacts): KeyFinding[] {
  const candidates: Array<{ when: boolean; finding: KeyFinding }> = [];
  const top = facts.topInitiatives[0];

  if (facts.totalInitiatives > 0) {
    candidates.push({
      when: true,
      finding: {
        title: `${facts.totalInitiatives} initiatives sequence the multi-year transformation programme`,
        body: `${facts.totalInitiatives} active initiative${facts.totalInitiatives === 1 ? "" : "s"} sequence the ${facts.clientName} transformation programme; ${facts.waves.NOW} land${facts.waves.NOW === 1 ? "s" : ""} in Wave 1 (<12 months), ${facts.waves.NEXT} in Wave 2 (12-24 months), and ${facts.waves.LATER} in the long-horizon Wave 3.${top ? ` ${top.name} anchors the priority cohort by composite weight.` : ""} The wave breakdown defines the FY budget commitment shape; Wave 1 carries the forced timeline, Wave 2 carries the dependency risk, Wave 3 frames the trajectory.`,
      },
    });
  }

  if (facts.keystone) {
    candidates.push({
      when: true,
      finding: {
        title: `${facts.keystone.name} is the dependency keystone`,
        body: `${facts.keystone.name} carries the highest in-degree (${facts.keystone.inDegree} downstream initiative${facts.keystone.inDegree === 1 ? "" : "s"} depend on it) and gates the broader sequencing. Slipping the keystone cascades across ${facts.keystone.inDegree} downstream commitment${facts.keystone.inDegree === 1 ? "" : "s"}; protecting its delivery is the single highest-leverage action in the programme. Track the keystone weekly at steerco; rebaseline only with executive approval.`,
      },
    });
  }

  if (facts.fullBridgePct > 0) {
    candidates.push({
      when: true,
      finding: {
        title: `${facts.fullBridgePct}% of initiatives carry the full cross-deliverable bridge`,
        body: `${facts.fullBridgePct}% of the ${facts.totalInitiatives} initiative${facts.totalInitiatives === 1 ? "" : "s"} link to BOTH applications (rationalization output) and capabilities (maturity output) — the platform's distinguishing structural attribute. ${facts.appLinkedPct}% link applications and ${facts.capabilityLinkedPct}% link capabilities individually. The bridge enables the cross-reference between disposition decisions and capability lift; sustaining the mapping is a precondition for the live-artifact regeneration flow.`,
      },
    });
  }

  if (facts.workspaceRisks.redRag > 0) {
    candidates.push({
      when: true,
      finding: {
        title: `${facts.workspaceRisks.redRag} initiative${facts.workspaceRisks.redRag === 1 ? "" : "s"} sit at RED RAG status`,
        body: `${facts.workspaceRisks.redRag} initiative${facts.workspaceRisks.redRag === 1 ? "" : "s"} carry${facts.workspaceRisks.redRag === 1 ? "" : ""} a RED RAG status — active concern requiring steerco attention. The RED cohort represents data-grounded delivery risk to the wave commitments rather than analytical projection; recovery plans before any FY budget commit. The cohort sequencing influences the Wave-1 anchor decision: gating the wave on incomplete RED-status work invites cascade-slip.`,
      },
    });
  }

  if (facts.workspaceRisks.wave1WithoutOwner > 0) {
    candidates.push({
      when: true,
      finding: {
        title: `${facts.workspaceRisks.wave1WithoutOwner} Wave-1 initiative${facts.workspaceRisks.wave1WithoutOwner === 1 ? "" : "s"} lack${facts.workspaceRisks.wave1WithoutOwner === 1 ? "s" : ""} an owner`,
        body: `${facts.workspaceRisks.wave1WithoutOwner} of the ${facts.waves.NOW} Wave-1 initiative${facts.waves.NOW === 1 ? "" : "s"} lack a named owner — accountability gap that blocks Wave-1 commit. Owner assignment is the first gate the FY budget cycle walks through; without it, even on-time delivery has no escalation path. Assign owners before Steerco approval; capability-application owners on the rationalization + maturity side often map to the same names, which compounds the data-collection effort.`,
      },
    });
  }

  if (facts.workspaceRisks.orphaned > 0) {
    candidates.push({
      when: true,
      finding: {
        title: `${facts.workspaceRisks.orphaned} initiative${facts.workspaceRisks.orphaned === 1 ? "" : "s"} sit orphaned without cross-deliverable anchor`,
        body: `${facts.workspaceRisks.orphaned} initiative${facts.workspaceRisks.orphaned === 1 ? "" : "s"} carry neither a linked application nor a linked capability — orphaned from both prior deliverables. The strategic value of an orphaned initiative is harder to defend at a steerco than one anchored against a named application disposition or capability progression. Anchor each orphaned initiative against a named entity before the next portfolio review; the cross-deliverable bridge is the platform's primary signal of programme integrity.`,
      },
    });
  }

  candidates.push({
    when: true,
    finding: {
      title: `${facts.totalInitiatives} initiatives across ${Object.keys(facts.byCategoryCounts).length} categories define the scope`,
      body: `The portfolio spans ${facts.totalInitiatives} initiative${facts.totalInitiatives === 1 ? "" : "s"} across ${Object.keys(facts.byCategoryCounts).length} initiative categor${Object.keys(facts.byCategoryCounts).length === 1 ? "y" : "ies"}. Category mix and wave distribution together determine the programme's risk profile; the ${dominantCategoryName(facts.byCategoryCounts)} cohort carries the heaviest weight. Diversification across categories is itself a signal: a heavy MODERNISATION concentration reads differently than a heavy COMPLIANCE concentration, and the wave plans below sequence the actions accordingly.`,
    },
  });

  const out: KeyFinding[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (out.length >= 5) break;
    if (!c.when) continue;
    if (seen.has(c.finding.title)) continue;
    seen.add(c.finding.title);
    out.push(c.finding);
  }
  return out;
}

function dominantCategoryName(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0]?.replace(/_/g, " ") ?? "primary";
}

export async function generateWaveNarratives(
  facts: WaveNarrativesFacts,
  allowedCounts: number[],
  m: ArchitectureRoadmapMetrics
): Promise<{ source: "llm" | "deterministic_fallback"; result: WaveNarrativesResult }> {
  const totalCount =
    facts.waves.NOW.count + facts.waves.NEXT.count + facts.waves.LATER.count;
  if (totalCount === 0) {
    return {
      source: "deterministic_fallback",
      result: { narratives: deterministicWaveFallback(facts, m) },
    };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL_SONNET,
        max_tokens: 4500,
        system: ARCHITECTURE_ROADMAP_WAVE_NARRATIVES_PROMPT,
        messages: [
          { role: "user", content: `Facts:\n${JSON.stringify(facts, null, 2)}\n\nReturn JSON only.` },
        ],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      const raw = textBlock && "text" in textBlock ? (textBlock.text as string) : "";
      const parsed = parseJsonish(raw) as Partial<AllWaveNarratives>;
      const narratives = normalizeWaveNarratives(parsed);
      if (!narratives) continue;
      const allText = (["NOW", "NEXT", "LATER"] as const)
        .map(
          (k) =>
            `${narratives[k].governingThought} ${narratives[k].whyNow.join(" ")} ${narratives[k].whatItMeans} ${narratives[k].counterfactual} ${narratives[k].action}`
        )
        .join(" ");
      if (!verifyMaturityNumbers(allText, allowedCounts)) {
        console.warn(JSON.stringify({ evt: "roadmap_waves_fact_mismatch", attempt }));
        continue;
      }
      return { source: "llm", result: { narratives } };
    } catch (err) {
      console.warn(JSON.stringify({ evt: "roadmap_waves_llm_error", attempt, message: String(err) }));
    }
  }
  return {
    source: "deterministic_fallback",
    result: { narratives: deterministicWaveFallback(facts, m) },
  };
}

function normalizeWaveNarratives(
  parsed: Partial<AllWaveNarratives>
): AllWaveNarratives | null {
  const keys = ["NOW", "NEXT", "LATER"] as const;
  const out: Partial<AllWaveNarratives> = {};
  for (const k of keys) {
    const b = parsed[k];
    if (
      !b ||
      typeof b.governingThought !== "string" ||
      !Array.isArray(b.whyNow) ||
      typeof b.whatItMeans !== "string" ||
      typeof b.action !== "string"
    ) {
      return null;
    }
    const whyNow: string[] = [];
    for (let i = 0; i < 5; i++) {
      const v = b.whyNow[i];
      whyNow.push(typeof v === "string" && v.trim().length > 0 ? v : "—");
    }
    out[k] = {
      governingThought: b.governingThought,
      whyNow,
      whatItMeans: b.whatItMeans,
      counterfactual:
        typeof b.counterfactual === "string" && b.counterfactual.trim().length > 0
          ? b.counterfactual
          : "—",
      action: b.action,
    };
  }
  return out as AllWaveNarratives;
}

function deterministicWaveFallback(
  facts: WaveNarrativesFacts,
  _m: ArchitectureRoadmapMetrics
): AllWaveNarratives {
  const mk = (block: WaveFactsBlock, key: "NOW" | "NEXT" | "LATER"): WaveNarrative => {
    if (block.count === 0) {
      return {
        governingThought: "—",
        whyNow: ["—", "—", "—", "—", "—"],
        whatItMeans: "—",
        counterfactual: "—",
        action: "—",
      };
    }
    const top3 = block.topInitiatives.slice(0, 3).map((i) => i.name);
    const top5 = block.topInitiatives.slice(0, 5);
    const ragRed = block.ragMix.RED ?? 0;
    return {
      governingThought: `${block.count} initiative${block.count === 1 ? "" : "s"} sit in Wave ${key}, carrying ${block.cumulativeDependencyEdges} dependency edge${block.cumulativeDependencyEdges === 1 ? "" : "s"} and ${ragRed} RED-RAG concern${ragRed === 1 ? "" : "s"}.`,
      whyNow: top5.map((i) =>
        `${i.name} (${i.priority} priority, ${i.ragStatus} RAG) carries ${i.dependencyEdges} dependency edge${i.dependencyEdges === 1 ? "" : "s"} with ${i.appsLinkedCount} app${i.appsLinkedCount === 1 ? "" : "s"} + ${i.capabilitiesLinkedCount} capabilit${i.capabilitiesLinkedCount === 1 ? "y" : "ies"} mapped.`
      ).concat(["—", "—", "—", "—", "—"]).slice(0, 5),
      whatItMeans: `Wave ${key} carries ${block.count} commitment${block.count === 1 ? "" : "s"} with ${block.cumulativeDependencyEdges} dependency edge${block.cumulativeDependencyEdges === 1 ? "" : "s"}. The cross-wave sequencing risk concentrates here when downstream initiatives anchor on this wave's outputs. Application + capability owner accountability gates execution.`,
      counterfactual:
        key === "LATER"
          ? `Wave LATER slip is recoverable in the FY+1 plan; the long-horizon trajectory absorbs single-quarter slips without re-baselining.`
          : top3.length > 0
          ? `Without on-time Wave ${key} completion, ${top3.join(", ")} downstream sequencing slides right by a quarter; the cross-deliverable bridge to the rationalization + maturity plans loses execution alignment.`
          : `Without on-time Wave ${key} completion, downstream sequencing slides right; rebaseline the next-wave commitments accordingly.`,
      action: `Sequence Wave ${key} commitments by Q2; capability + application owners validate within 30 days; commit governance + funding in the FY26 budget cycle.`,
    };
  };
  return {
    NOW: mk(facts.waves.NOW, "NOW"),
    NEXT: mk(facts.waves.NEXT, "NEXT"),
    LATER: mk(facts.waves.LATER, "LATER"),
  };
}

export async function generateDeepDives(
  facts: DeepDivesFacts,
  topInitiatives: InitiativeWithWeight[],
  allowedCounts: number[]
): Promise<{ source: "llm" | "deterministic_fallback"; result: DeepDivesResult }> {
  if (facts.initiatives.length === 0) {
    return { source: "deterministic_fallback", result: { byId: {} } };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL_SONNET,
        max_tokens: 4500,
        system: ARCHITECTURE_ROADMAP_INITIATIVE_DEEP_DIVES_PROMPT,
        messages: [
          { role: "user", content: `Facts:\n${JSON.stringify(facts, null, 2)}\n\nReturn JSON only.` },
        ],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      const raw = textBlock && "text" in textBlock ? (textBlock.text as string) : "";
      const parsed = parseJsonish(raw) as Record<string, Partial<DeepDive>>;
      const byId: Record<string, DeepDive> = {};
      const topById = new Map(topInitiatives.map((i) => [i.id, i]));
      let valid = 0;
      for (const init of facts.initiatives) {
        const entry = parsed[init.id];
        if (
          entry &&
          typeof entry.dispositionRationale === "string" &&
          typeof entry.recommendedPath === "string" &&
          typeof entry.waveJustification === "string"
        ) {
          const fullInit = topById.get(init.id);
          const fallback = fullInit
            ? deterministicDeepDiveFallback(fullInit).riskProfile
            : "";
          byId[init.id] = {
            dispositionRationale: entry.dispositionRationale,
            recommendedPath: entry.recommendedPath,
            riskProfile:
              typeof entry.riskProfile === "string" &&
              entry.riskProfile.trim().length > 0
                ? entry.riskProfile
                : fallback,
            waveJustification: entry.waveJustification,
          };
          valid++;
        }
      }
      if (valid < facts.initiatives.length) continue;
      const allText = Object.values(byId)
        .map((d) => `${d.dispositionRationale} ${d.recommendedPath} ${d.riskProfile} ${d.waveJustification}`)
        .join(" ");
      if (!verifyMaturityNumbers(allText, allowedCounts)) {
        console.warn(JSON.stringify({ evt: "roadmap_deepdives_fact_mismatch", attempt }));
        continue;
      }
      return { source: "llm", result: { byId } };
    } catch (err) {
      console.warn(JSON.stringify({ evt: "roadmap_deepdives_llm_error", attempt, message: String(err) }));
    }
  }
  // Deterministic fallback
  const byId: Record<string, DeepDive> = {};
  for (const init of topInitiatives) {
    byId[init.id] = deterministicDeepDiveFallback(init);
  }
  return { source: "deterministic_fallback", result: { byId } };
}

function deterministicDeepDiveFallback(init: InitiativeWithWeight): DeepDive {
  const inDeg = init.blocking.length;
  const outDeg = init.dependsOn.length;
  const apps = init.appsLinked;
  const caps = init.capabilitiesLinked;

  // dispositionRationale
  const appsLine =
    apps.length === 0
      ? `No application is mapped to this initiative; the strategic value is harder to defend at a steerco without a cross-deliverable anchor.`
      : `Linked applications: ${apps.slice(0, 3).map((a) => `${a.name} [${a.rationalizationStatus ?? "UNCLASSIFIED"}, ${a.lifecycle.replace(/_/g, " ")}]`).join("; ")}.`;
  const capsLine =
    caps.length === 0
      ? `No capability is mapped; the lift case to the maturity plan is not yet structurally connected.`
      : `Linked capabilities: ${caps.slice(0, 3).map((c) => `${c.name} (${c.l1Name}, ${c.currentMaturity.replace(/_/g, " ")} → ${c.targetMaturity.replace(/_/g, " ")})`).join("; ")}.`;
  const dispositionRationale =
    `${init.name} sits in Wave ${init.wave} at ${init.priority} priority and ${init.ragStatus} RAG status, currently at ${init.progressPct}% progress. ` +
    `${appsLine} ` +
    `${capsLine} ` +
    `The composite priority weight ranks this initiative among the deep-dive cohort by combining priority score with dependency degree (${inDeg + outDeg} edges) and cross-deliverable impact.`;

  // recommendedPath — pick initiative-type classification
  let recPath: string;
  if (inDeg >= 3) {
    recPath = `Keystone classification: ${inDeg} downstream initiative${inDeg === 1 ? "" : "s"} depend on this one. Load-test the dependency map before any commit; gate the wave handoff on this initiative's completion. Steerco-track weekly through Wave-1 execution.`;
  } else if (outDeg >= 2) {
    recPath = `Blocked classification: depends on ${outDeg} upstream initiative${outDeg === 1 ? "" : "s"} (${init.dependsOn.slice(0, 2).map((d) => d.initiativeName).join("; ")}). Sequence after upstream completion; protect against cascade-slip; do not commit Wave dates until upstream RAG-status clears AMBER or GREEN.`;
  } else if (apps.length === 0 && caps.length === 0) {
    recPath = `Orphaned classification: no linked apps and no linked capabilities. Anchor the initiative against a named capability or application before commit; confirm strategic value at the next portfolio review before allocating capacity.`;
  } else if (init.category === "COMPLIANCE") {
    recPath = `Regulatory cohort classification: COMPLIANCE category drives a non-discretionary timeline. Sequence around the regulatory deadline rather than against capability readiness; the wave assignment is forced by external dates, not internal optimization.`;
  } else {
    recPath = `Standalone classification: no dependency edges and ≥1 cross-deliverable anchor. Standard programme governance; capability and application readiness already mapped; sequence per wave heuristic without bespoke escalation.`;
  }

  // riskProfile — pick dominant risk class
  let riskProfile: string;
  if (inDeg >= 3) {
    riskProfile = `Cascade risk dominates: as a keystone with ${inDeg} downstream dependent${inDeg === 1 ? "" : "s"} (${init.blocking.slice(0, 2).map((d) => d.initiativeName).join("; ")}), slipping ${init.name} cascades across the dependent cohort. Mitigation: track weekly at steerco; protect the dependency map; gate wave handoffs on completion.`;
  } else if (apps.some((a) => a.rationalizationStatus === "ELIMINATE" || a.lifecycle === "PHASING_OUT")) {
    const e = apps.find((a) => a.rationalizationStatus === "ELIMINATE" || a.lifecycle === "PHASING_OUT");
    riskProfile = `Linked-app ELIMINATE risk: ${e?.name ?? "the linked application"} sits in PHASING_OUT lifecycle; the initiative's tooling foundation has a known sunset. The lift cannot lag the retirement. Mitigation: gate the timeline against the application's decommission calendar; sequence both as a single Wave-1 cohort.`;
  } else if (caps.some((c) => c.currentMaturity === "INITIAL" || c.currentMaturity === "DEVELOPING")) {
    const c = caps.find((x) => x.currentMaturity === "INITIAL" || x.currentMaturity === "DEVELOPING")!;
    riskProfile = `Capability-immaturity risk: ${c.name} sits at ${c.currentMaturity.replace(/_/g, " ")} maturity targeting ${c.targetMaturity.replace(/_/g, " ")}; the lift inside this initiative's scope is steep. Mitigation: stand up centre-of-excellence anchoring on the ${c.l1Name} domain before kickoff; gate Wave-1 lift on owner accountability.`;
  } else if (!init.hasOwner && init.wave === "NOW") {
    riskProfile = `Ownership risk: ${init.name} sits in Wave 1 with no named owner. Without owner accountability, even on-time delivery has no escalation path. Mitigation: assign owner before Steerco approval; capability + application owner pairs on the rationalization + maturity side often map to the same names.`;
  } else if (init.ragStatus === "AMBER" || init.ragStatus === "RED") {
    riskProfile = `RAG risk: ${init.ragStatus} status reads as data-grounded delivery concern, not analytical projection. Mitigation: surface root cause + recovery plan at the next steerco; rebaseline timeline if scope inflation drove the slip; capability + application owners co-validate.`;
  } else {
    riskProfile = `Standard execution risk: balanced dependency profile, anchored cross-deliverable bridge, GREEN RAG. Mitigation: standard programme governance; capability and application owner check-ins per wave gate.`;
  }

  return {
    dispositionRationale,
    recommendedPath: recPath,
    riskProfile,
    waveJustification: `Wave ${init.wave}: driven by ${init.priority} priority${apps.length > 0 ? `, mapped applications` : ""}${caps.length > 0 ? `, capability anchor` : ""}${inDeg >= 3 ? `, keystone in-degree ${inDeg}` : ""}.`,
  };
}

// ─── Shared parsing helper ───────────────────────────────────

function parseJsonish(raw: string): Record<string, unknown> {
  // Strip markdown fences if the model wrapped its output
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    // Try to extract the first JSON object
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return {};
  }
}
