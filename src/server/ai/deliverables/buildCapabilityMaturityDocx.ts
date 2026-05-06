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
  CAPABILITY_MATURITY_EXEC_SUMMARY_PROMPT,
  CAPABILITY_MATURITY_EXEC_SUMMARY_VERSION,
} from "@/server/ai/prompts/capabilityMaturityExecSummary.v1";
import {
  CAPABILITY_MATURITY_KEY_FINDINGS_PROMPT,
  CAPABILITY_MATURITY_KEY_FINDINGS_VERSION,
} from "@/server/ai/prompts/capabilityMaturityKeyFindings.v1";
import {
  CAPABILITY_MATURITY_BAND_NARRATIVES_PROMPT,
  CAPABILITY_MATURITY_BAND_NARRATIVES_VERSION,
} from "@/server/ai/prompts/capabilityMaturityBandNarratives.v1";
import {
  CAPABILITY_MATURITY_DEEP_DIVES_PROMPT,
  CAPABILITY_MATURITY_DEEP_DIVES_VERSION,
} from "@/server/ai/prompts/capabilityMaturityDeepDives.v1";
import {
  buildActionTitle,
  buildHeading,
  buildCallout,
  buildKpiRow,
  buildStaticTOC,
  buildStatusPillCell,
  buildTable,
  clampForContrast,
  formatDateISO,
  importanceToTone,
  makeFooter,
  maturityToTone,
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
  CapabilityMaturityMetrics,
  CapabilitySummary,
  CapabilityWithGap,
} from "./capabilityMaturityMetrics";
import { buildCriticalMaturityBar } from "./charts/buildCriticalMaturityBar";
import { buildImportanceMaturityMatrix } from "./charts/buildImportanceMaturityMatrix";
import { buildL1MaturityHeatmap } from "./charts/buildL1MaturityHeatmap";

export const CAPABILITY_MATURITY_TEMPLATE_VERSION = "1.0";
export const CAPABILITY_MATURITY_TEMPLATE_LABEL = `EAM Capability Maturity Template v${CAPABILITY_MATURITY_TEMPLATE_VERSION}`;
export const CAPABILITY_MATURITY_PROJECT_LABEL = "Capability Maturity Assessment";

export type CapabilityMaturityDocxInput = {
  clientName: string;
  brandHex: string | null;
  preparedBy?: string | null;
  engagementCode?: string | null;
  contactLine?: string | null;
  metrics: CapabilityMaturityMetrics;
};

export type CapabilityMaturityDocxResult = {
  buffer: Buffer;
  templateVersion: string;
  llmSource: AggregateSource;
  llmSourceDetail: string;
};

// ─── LLM call result shapes ───────────────────────────────────

type ExecSummaryResult = { text: string };
type KeyFinding = { title: string; body: string };
type KeyFindingsResult = { findings: KeyFinding[] };

type BandNarrative = {
  governingThought: string;
  whyNow: [string, string, string];
  whatItMeans: string;
  action: string;
};
type AllBandNarratives = {
  LIFT_TO_TARGET: BandNarrative;
  SUSTAIN: BandNarrative;
  INVEST_BEYOND_TARGET: BandNarrative;
  REASSESS_STRATEGY: BandNarrative;
};
type BandNarrativesResult = { narratives: AllBandNarratives };

type DeepDive = {
  dispositionRationale: string;
  recommendedPath: string;
  waveJustification: string;
};
type DeepDivesResult = { byId: Record<string, DeepDive> };

// ─── Main builder ─────────────────────────────────────────────

export async function buildCapabilityMaturityDocx(
  input: CapabilityMaturityDocxInput
): Promise<CapabilityMaturityDocxResult> {
  const brandHex = normalizeHex(input.brandHex);
  const m = input.metrics;
  const today = formatDateISO();

  // Pre-compute key counts that drive deterministic prose +
  // fact-grounding allowed numbers.
  const allowedCounts = collectAllowedCounts(m);

  // Build LLM facts (deterministic JSON inputs).
  const execFacts = buildExecSummaryFacts(m, input.clientName);
  const keyFindingsFacts = buildKeyFindingsFacts(m, input.clientName);
  const bandNarrativesFacts = buildBandNarrativesFacts(m, input.clientName);
  const topAppsForDeepDives = m.topGapsByImpact.slice(0, 5);
  const deepDivesFacts = buildDeepDivesFacts(
    topAppsForDeepDives,
    input.clientName
  );

  // Run 4 LLM calls in parallel + 3 chart renders. The shared
  // _orchestrator emits both an aggregate source and a granular
  // detail string for the X-Llm-Source-Detail header.
  const [llmOut, criticalBarChart, matrixChart, l1HeatmapChart] =
    await Promise.all([
      runDeliverableLLMCalls<{
        execSummary: ExecSummaryResult;
        keyFindings: KeyFindingsResult;
        bandNarratives: BandNarrativesResult;
        deepDives: DeepDivesResult;
      }>({
        execSummary: () => generateExecSummary(execFacts, allowedCounts, m, input.clientName),
        keyFindings: () => generateKeyFindings(keyFindingsFacts, allowedCounts, m),
        bandNarratives: () => generateBandNarratives(bandNarrativesFacts, allowedCounts, m),
        deepDives: () => generateDeepDives(deepDivesFacts, topAppsForDeepDives, allowedCounts),
      }),
      buildCriticalMaturityBar({
        capabilities: m.bands.liftToTarget
          .filter((c) => c.strategicImportance === "CRITICAL")
          .slice(0, 8)
          .map((c) => ({
            name: c.name,
            currentMaturity: c.currentMaturity,
            targetMaturity: c.targetMaturity,
            appCount: c.appsMappedCount,
          })),
        brandHex,
      }).catch((err) => {
        console.warn(JSON.stringify({ evt: "chart_render_error", chart: "critical_bar", message: String(err) }));
        return null;
      }),
      buildImportanceMaturityMatrix({
        cells: m.importanceMaturityMatrix,
        brandHex,
      }).catch((err) => {
        console.warn(JSON.stringify({ evt: "chart_render_error", chart: "importance_maturity_matrix", message: String(err) }));
        return null;
      }),
      buildL1MaturityHeatmap({
        rows: m.l1Rollups
          .slice(0, 8)
          .map((r) => ({
            l1Name: r.l1Name,
            byMaturity: r.byMaturity,
            currentMean: r.currentMean,
            targetMean: r.targetMean,
            totalChildren: r.childCount,
          })),
        brandHex,
      }).catch((err) => {
        console.warn(JSON.stringify({ evt: "chart_render_error", chart: "l1_heatmap", message: String(err) }));
        return null;
      }),
    ]);

  const { results, aggregateSource, sourceDetail } = llmOut;
  const execSummaryText = results.execSummary.text;
  const keyFindings = results.keyFindings.findings;
  const bandNarratives = results.bandNarratives.narratives;
  const deepDivesById = results.deepDives.byId;

  const children: Array<Paragraph | Table> = [];

  // Cover
  children.push(
    ...renderCoverPage({
      documentTitle: "Capability Maturity Assessment",
      clientName: input.clientName,
      brandHex,
      templateVersionLabel: CAPABILITY_MATURITY_TEMPLATE_LABEL,
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

  // Static TOC (page numbers are best-guess; off-by-one acceptable)
  children.push(
    ...buildStaticTOC({
      brandHex,
      entries: [
        { title: "1. Synthesis", pageNumber: 4, indent: 0 },
        { title: "Portfolio at a Glance", pageNumber: 4, indent: 1 },
        { title: "Five Key Findings", pageNumber: 5, indent: 1 },
        { title: "Maturity Dashboard", pageNumber: 6, indent: 1 },
        { title: "2. Current State", pageNumber: 7, indent: 0 },
        { title: "Executive Summary", pageNumber: 7, indent: 1 },
        { title: "Strategic Importance × Maturity", pageNumber: 8, indent: 1 },
        { title: "L1 Domain Maturity", pageNumber: 9, indent: 1 },
        { title: "Capability-Application Coverage", pageNumber: 10, indent: 1 },
        { title: "3. Maturity Bands", pageNumber: 11, indent: 0 },
        { title: "Lift to Target", pageNumber: 11, indent: 1 },
        { title: "Sustain at Target", pageNumber: 12, indent: 1 },
        { title: "Invest Beyond Target", pageNumber: 13, indent: 1 },
        { title: "Reassess Strategy", pageNumber: 14, indent: 1 },
        { title: "4. Capability Deep Dives", pageNumber: 15, indent: 0 },
        { title: "5. Investment Roadmap", pageNumber: 20, indent: 0 },
        { title: "Wave Sequencing", pageNumber: 20, indent: 1 },
        { title: "Risks & Considerations", pageNumber: 21, indent: 1 },
        { title: "Next Steps", pageNumber: 22, indent: 1 },
        { title: "6. Appendices", pageNumber: 23, indent: 0 },
        { title: "Appendix A — Capability Listing", pageNumber: 23, indent: 1 },
        { title: "Appendix B — Methodology & Data Sources", pageNumber: 24, indent: 1 },
        { title: "Appendix C — Glossary", pageNumber: 25, indent: 1 },
      ],
    })
  );

  // ═══ 1. SYNTHESIS ═══════════════════════════════════════════
  children.push(
    ...renderSectionDivider({
      number: "1",
      title: "Synthesis",
      subtitle:
        "The headline gap, the priority lift, the largest concentration, and the recommended Wave-1 sequence — answered before the analysis begins.",
      brandHex,
    })
  );

  const liftCount = m.bands.liftToTarget.length;
  const totalLiftLevels = m.bands.liftToTarget.reduce(
    (s, c) => s + (c.gapLevels ?? 0),
    0
  );
  const topL1 = m.l1Rollups[0];
  const coveragePct = Math.round(m.assessmentCoverageRatio * 100);
  const criticalCount = m.byStrategicImportance.CRITICAL ?? 0;

  // Portfolio at a Glance — KPI hero row
  children.push(
    buildHeading("Portfolio at a Glance", HeadingLevel.HEADING_1, brandHex, {
      spacingBefore: 0,
    })
  );
  children.push(
    buildActionTitle(
      `${m.totalCapabilities} capabilities assessed at ${coveragePct}% coverage; ${liftCount} priority lift candidates carry ${totalLiftLevels} cumulative maturity-level gaps anchored on the ${topL1?.l1Name ?? "primary"} domain.`,
      brandHex
    )
  );
  children.push(
    buildKpiRow({
      brandHex,
      tiles: [
        {
          value: String(m.totalCapabilities),
          label: "Capabilities assessed",
        },
        {
          value: `${coveragePct}%`,
          label: "Assessment coverage",
        },
        {
          value: String(liftCount),
          label: "Priority lift candidates",
        },
        {
          value: String(totalLiftLevels),
          label: "Cumulative gap levels",
        },
        {
          value: String(criticalCount),
          label: "CRITICAL capabilities",
        },
        {
          value: String(m.l1Rollups.length),
          label: "L1 domains",
        },
      ],
    })
  );

  // Synthesis hero chart — CRITICAL maturity bar
  if (criticalBarChart) {
    children.push(criticalBarChart);
  }

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
        spacing: { before: 160, after: 60 },
        children: [
          new TextRun({
            text: `${i + 1}. `,
            bold: true,
            color: clampForContrast({ hex: brandHex }),
            size: T.body,
          }),
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
        spacing: { after: 120, line: 320 },
        indent: { left: 360 },
        children: renderInline(f.body),
      })
    );
  }

  // Maturity Dashboard
  children.push(
    buildHeading("Maturity Dashboard", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    buildActionTitle(
      `The action-band mix at a glance: which capabilities require lift, which sustain, which warrant beyond-target investment, which need reassessment.`,
      brandHex
    )
  );
  children.push(buildMaturityDashboard(m, brandHex));

  children.push(
    sectionCloser(
      `${liftCount} priority lift candidates anchor the timing; ${topL1?.l1Name ?? "the lead L1 domain"} concentration anchors the sequencing; the ${m.bands.investBeyondTarget.length} invest-beyond-target capabilities set the trajectory.`,
      brandHex
    )
  );

  // ═══ 2. CURRENT STATE ═══════════════════════════════════════
  children.push(
    ...renderSectionDivider({
      number: "2",
      title: "Current State",
      subtitle:
        "How the capability portfolio looks today: importance vs maturity tension, L1 domain concentration, application coverage.",
      brandHex,
    })
  );

  // Executive Summary
  children.push(
    buildHeading("Executive Summary", HeadingLevel.HEADING_1, brandHex, {
      spacingBefore: 0,
    })
  );
  children.push(
    buildActionTitle(
      `${m.totalCapabilities} capabilities across ${m.l1Rollups.length} L1 domains; ${liftCount} require lift on a forced-priority timeline based on strategic importance.`,
      brandHex
    )
  );
  for (const para of execSummaryText.split(/\n{2,}/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    children.push(
      new Paragraph({
        spacing: { after: 160, line: 320 },
        children: renderInline(trimmed),
      })
    );
  }

  // Strategic Importance × Current Maturity
  children.push(
    buildHeading(
      "Strategic Importance × Current Maturity",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );
  const criticalAtLow = m.bands.liftToTarget.filter(
    (c) =>
      c.strategicImportance === "CRITICAL" &&
      (c.currentMaturity === "INITIAL" || c.currentMaturity === "DEVELOPING")
  ).length;
  children.push(
    buildActionTitle(
      criticalAtLow > 0
        ? `${criticalAtLow} CRITICAL capabilities sit at INITIAL or DEVELOPING maturity — the priority lift quadrant that justifies the FY capability investment plan.`
        : `CRITICAL capabilities cluster at MANAGED or above; the lever in this portfolio is the HIGH-importance lift, not the CRITICAL emergency.`,
      brandHex
    )
  );
  if (matrixChart) {
    children.push(matrixChart);
  }
  children.push(
    new Paragraph({
      spacing: { before: 80, after: 200 },
      children: [
        new TextRun({
          text: "Quadrant convention: CRITICAL/HIGH × INITIAL/DEVELOPING reads as priority lift; CRITICAL/HIGH × MANAGED/OPTIMIZING reads as sustain; LOW × MANAGED/OPTIMIZING reads as reassess (over-served).",
          italics: true,
          size: 18,
          color: "6B7280",
        }),
      ],
    })
  );

  // L1 Domain Maturity
  children.push(
    buildHeading("L1 Domain Maturity", HeadingLevel.HEADING_1, brandHex)
  );
  if (topL1 && topL1.totalGapLevels > 0) {
    children.push(
      buildActionTitle(
        `${topL1.l1Name} owns ${topL1.totalGapLevels} cumulative gap-levels across ${topL1.childCount} L2/L3 capabilities — the largest single domain investment ask in the portfolio.`,
        brandHex
      )
    );
  } else {
    children.push(
      buildActionTitle(
        `Maturity distribution is balanced across L1 domains; no single domain dominates the investment ask.`,
        brandHex
      )
    );
  }
  if (l1HeatmapChart) {
    children.push(l1HeatmapChart);
  }

  // Capability-Application Coverage (the cross-deliverable bridge)
  children.push(
    buildHeading(
      "Capability-Application Coverage",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );
  pushCapabilityAppCoverage(children, m, brandHex);

  children.push(
    sectionCloser(
      `Importance-vs-maturity tension plus L1 concentration plus application-readiness frame the three axes of investment; the band sections below sequence the actions.`,
      brandHex
    )
  );

  // ═══ 3. MATURITY BANDS ══════════════════════════════════════
  children.push(
    ...renderSectionDivider({
      number: "3",
      title: "Maturity Bands",
      subtitle:
        "Each action-class band carries its own governing thought, evidence, implication, and recommended action.",
      brandHex,
    })
  );

  pushBandSection(
    children,
    "Lift to Target — Priority Investment",
    bandNarratives.LIFT_TO_TARGET,
    m.bands.liftToTarget.slice(0, 12),
    brandHex
  );
  pushBandSection(
    children,
    "Sustain at Target — Hold Position",
    bandNarratives.SUSTAIN,
    m.bands.sustainAtTarget.slice(0, 12),
    brandHex
  );
  pushBandSection(
    children,
    "Invest Beyond Target — Lead the Industry",
    bandNarratives.INVEST_BEYOND_TARGET,
    m.bands.investBeyondTarget.slice(0, 12),
    brandHex
  );
  pushBandSection(
    children,
    "Reassess Strategy — Rebalance Investment",
    bandNarratives.REASSESS_STRATEGY,
    m.bands.reassessStrategy.slice(0, 12),
    brandHex
  );

  if (m.bands.notAssessed.length > 0) {
    children.push(
      buildCallout({
        title: `Coverage Gap — ${m.bands.notAssessed.length} capabilities not yet assessed`,
        tone: "warn",
        bullets: [
          `${m.bands.notAssessed.length} of ${m.totalCapabilities} capabilities (${Math.round((m.bands.notAssessed.length / m.totalCapabilities) * 100)}%) carry NOT_ASSESSED on either current or target maturity.`,
          `Assessment workshops with capability owners close this gap before the next portfolio review; until then the investment case for these capabilities cannot be framed.`,
        ],
        brandHex,
      })
    );
  }

  children.push(
    sectionCloser(
      `Each band carries its own clock; the deep dives below extend the case for the top-priority capabilities individually.`,
      brandHex
    )
  );

  // ═══ 4. CAPABILITY DEEP DIVES ═══════════════════════════════
  if (topAppsForDeepDives.length > 0) {
    children.push(
      ...renderSectionDivider({
        number: "4",
        title: "Capability Deep Dives",
        subtitle:
          "Top-priority gap capabilities. Disposition rationale, application coverage, recommended path, wave assignment.",
        brandHex,
      })
    );
    for (const cap of topAppsForDeepDives) {
      pushDeepDiveSection(
        children,
        cap,
        deepDivesById[cap.id] ?? null,
        brandHex
      );
    }
    children.push(
      sectionCloser(
        `Top-priority capabilities carry the programme's substance; the recommendations below sequence the timing, risks, and execution scaffolding.`,
        brandHex
      )
    );
  }

  // ═══ 5. INVESTMENT ROADMAP ══════════════════════════════════
  const sectionNumberRoadmap = topAppsForDeepDives.length > 0 ? "5" : "4";
  children.push(
    ...renderSectionDivider({
      number: sectionNumberRoadmap,
      title: "Investment Roadmap",
      subtitle:
        "Wave sequencing, risks, and the first thirty days of execution.",
      brandHex,
    })
  );

  // Wave Sequencing
  children.push(
    buildHeading("Wave Sequencing", HeadingLevel.HEADING_1, brandHex, {
      spacingBefore: 0,
    })
  );
  pushWaveSequencing(children, m, brandHex);

  // Risks
  children.push(
    buildHeading("Risks & Considerations", HeadingLevel.HEADING_1, brandHex)
  );
  pushRisksSection(children, m, brandHex);

  // Next Steps
  children.push(buildHeading("Next Steps", HeadingLevel.HEADING_1, brandHex));
  children.push(
    buildActionTitle(
      "Six actions move the programme from analysis to execution within twelve weeks; owners and dependencies are placeholders for engagement-team override.",
      brandHex
    )
  );
  children.push(
    new Paragraph({
      spacing: { after: 160, line: 320 },
      children: renderInline(
        `**Over the next 30 days,** capability owners validate the ${m.bands.liftToTarget.length} priority lift candidates against the application-coverage map and confirm the wave-1 sequence. The technical-architecture team load-tests retained platforms before any tooling commitment opens. Steerco approval gates the start of Wave-1 execution by Week 12.`
      ),
    })
  );
  children.push(buildNextStepsTable(m, brandHex));

  children.push(
    sectionCloser(
      `The roadmap dates the work; the risks frame the gating events; the next-30-day actions kick the programme off.`,
      brandHex
    )
  );

  // ═══ 6. APPENDICES ══════════════════════════════════════════
  const sectionNumberAppendix = topAppsForDeepDives.length > 0 ? "6" : "5";
  children.push(
    ...renderSectionDivider({
      number: sectionNumberAppendix,
      title: "Appendices",
      subtitle:
        "Full capability listing, methodology, and glossary of the framework terminology.",
      brandHex,
    })
  );

  // Appendix A: Full capability listing
  children.push(
    buildHeading(
      "Appendix A — Capability Listing",
      HeadingLevel.HEADING_1,
      brandHex,
      { spacingBefore: 0 }
    )
  );
  pushAppendixA(children, m, brandHex);

  // Appendix B: Methodology
  children.push(
    buildHeading(
      "Appendix B — Methodology & Data Sources",
      HeadingLevel.HEADING_1,
      brandHex
    )
  );
  pushAppendixB(children, m, today);

  // Appendix C: Glossary
  children.push(
    buildHeading("Appendix C — Glossary", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(buildGlossaryTable(brandHex));

  // ─── Build doc ────────────────────────────────────────────
  const doc = new Document({
    creator: input.clientName,
    title: `${input.clientName} — Capability Maturity Assessment`,
    description: CAPABILITY_MATURITY_TEMPLATE_LABEL,
    sections: [
      {
        properties: {},
        children: children as never,
        footers: {
          default: makeFooter(
            input.clientName,
            CAPABILITY_MATURITY_PROJECT_LABEL
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
    templateVersion: CAPABILITY_MATURITY_TEMPLATE_VERSION,
    llmSource: aggregateSource,
    llmSourceDetail: sourceDetail,
  };
}

// ═══ Helpers ═══════════════════════════════════════════════════

/** Section closer — italic 13pt brand-color line at chapter end. */
function sectionCloser(text: string, brandHex: string): Paragraph {
  return new Paragraph({
    spacing: { before: 320, after: 320, line: 320 },
    indent: { left: 360, right: 360 },
    children: [
      new TextRun({
        text,
        italics: true,
        size: T.h3,
        color: clampForContrast({ hex: brandHex }),
      }),
    ],
  });
}

/** Maturity Dashboard — synthesis-layer summary table by band. */
function buildMaturityDashboard(
  m: CapabilityMaturityMetrics,
  brandHex: string
): Table {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const headerBottom = {
    style: BorderStyle.SINGLE,
    size: 12,
    color: brandHex,
  };
  const widths = [22, 12, 18, 28, 20];
  const headers = ["Band", "Count", "Cumulative Gap", "Top Capability", "Wave"];
  const headerCells = headers.map(
    (h, i) =>
      new TableCell({
        width: { size: widths[i]!, type: WidthType.PERCENTAGE },
        shading: { fill: "FFFFFF" },
        borders: {
          top: noBorder,
          bottom: headerBottom,
          left: noBorder,
          right: noBorder,
        },
        children: [
          new Paragraph({
            alignment: i === 1 || i === 2 ? AlignmentType.RIGHT : AlignmentType.LEFT,
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({
                text: h,
                bold: true,
                size: T.small,
                color: clampForContrast({ hex: brandHex }),
              }),
            ],
          }),
        ],
      })
  );

  const rows: Array<{
    name: string;
    tone: Tone;
    items: CapabilityWithGap[];
    wave: string;
    waveTone: Tone;
  }> = [
    { name: "LIFT TO TARGET", tone: "danger", items: m.bands.liftToTarget, wave: "NOW", waveTone: "danger" },
    { name: "INVEST BEYOND", tone: "info", items: m.bands.investBeyondTarget, wave: "LATER", waveTone: "info" },
    { name: "SUSTAIN", tone: "success", items: m.bands.sustainAtTarget, wave: "—", waveTone: "info" },
    { name: "REASSESS", tone: "warn", items: m.bands.reassessStrategy, wave: "NEXT", waveTone: "warn" },
  ];

  const bodyRows = rows.map((r, idx) => {
    const baseFill = idx % 2 === 1 ? "FAFAFA" : "FFFFFF";
    const cumGap = r.items.reduce(
      (s, c) => s + Math.abs(c.gapLevels ?? 0),
      0
    );
    const top = r.items[0];
    return new TableRow({
      children: [
        buildStatusPillCell({ text: r.name, tone: r.tone }),
        cellText({
          text: String(r.items.length),
          fill: baseFill,
          align: AlignmentType.RIGHT,
          font: "Consolas",
        }),
        cellText({
          text: cumGap > 0 ? String(cumGap) : "—",
          fill: baseFill,
          align: AlignmentType.RIGHT,
          font: "Consolas",
        }),
        cellText({
          text: top?.name ?? "—",
          fill: baseFill,
          align: AlignmentType.LEFT,
        }),
        r.items.length === 0
          ? cellText({ text: "—", fill: baseFill, align: AlignmentType.CENTER })
          : buildStatusPillCell({ text: r.wave, tone: r.waveTone }),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: noBorder,
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
      insideHorizontal: noBorder,
      insideVertical: noBorder,
    },
    rows: [
      new TableRow({ tableHeader: true, children: headerCells }),
      ...bodyRows,
    ],
  });
}

/** Capability ↔ Application coverage section (cross-deliverable bridge). */
function pushCapabilityAppCoverage(
  children: Array<Paragraph | Table>,
  m: CapabilityMaturityMetrics,
  brandHex: string
): void {
  const priorityCaps = m.bands.liftToTarget;
  const withApps = priorityCaps.filter((c) => c.appsMappedCount > 0);
  const orphaned = priorityCaps.filter((c) => c.appsMappedCount === 0);
  const totalLiftCount = priorityCaps.length;

  const readinessPct =
    totalLiftCount > 0 ? Math.round((withApps.length / totalLiftCount) * 100) : 0;

  children.push(
    buildActionTitle(
      totalLiftCount === 0
        ? `No priority lift candidates require application-coverage analysis.`
        : `${readinessPct}% of priority lift candidates have applications mapped (execution-ready); ${orphaned.length} are orphaned and require tooling stand-up before capability lift.`,
      brandHex
    )
  );

  if (totalLiftCount === 0) return;

  // Cross-reference table: priority capabilities and their linked apps' TIME dispositions.
  const rows: string[][] = priorityCaps.slice(0, 12).map((c) => {
    const dispositions = c.appsMapped
      .map((a) => `${a.name} [${a.rationalizationStatus ?? "—"}]`)
      .slice(0, 2)
      .join("; ");
    return [
      c.name,
      c.l1Name,
      c.currentMaturity.replace(/_/g, " "),
      c.targetMaturity.replace(/_/g, " "),
      c.appsMappedCount > 0 ? dispositions || "—" : "no apps mapped",
    ];
  });

  children.push(
    buildTable({
      headers: ["Capability", "L1 Domain", "Current", "Target", "Apps + TIME Disposition"],
      rows,
      brandHex,
      columnWidthsPct: [26, 18, 12, 12, 32],
    })
  );

  if (orphaned.length > 0) {
    children.push(
      buildCallout({
        title: `${orphaned.length} priority capabilities have no application mapped`,
        tone: "warn",
        bullets: [
          `Capability lift requires standing up dedicated tooling — different programme economics than uplifting an existing app.`,
          `Wave sequencing accounts for the tooling stand-up dependency: orphaned capabilities default to NEXT/LATER unless a parallel rationalization track funds new tooling.`,
        ],
        brandHex,
      })
    );
  }
}

/** Per-band narrative section. Action title (deterministic),
 *  governing thought + why now + what it means + recommended action
 *  (LLM), apps table.  Mirrors pushBucketSection in the
 *  rationalization builder. */
function pushBandSection(
  children: Array<Paragraph | Table>,
  title: string,
  narrative: BandNarrative,
  capabilities: CapabilityWithGap[],
  brandHex: string
): void {
  children.push(buildHeading(title, HeadingLevel.HEADING_1, brandHex));

  if (capabilities.length === 0) {
    children.push(
      buildCallout({
        title: "No capabilities in this band",
        tone: "info",
        bullets: [
          "Capabilities matching this action-class will populate this section in future runs.",
        ],
        brandHex,
      })
    );
    return;
  }

  const top2 = capabilities.slice(0, 2).map((c) => c.name);
  const cumGap = capabilities.reduce((s, c) => s + Math.abs(c.gapLevels ?? 0), 0);
  const bandKey = title.split(" ")[0]; // "Lift", "Sustain", "Invest", "Reassess"

  let actionTitle: string;
  if (bandKey === "Lift") {
    actionTitle = `${capabilities.length} priority capabilities (${top2.join(" and ")}) require ${cumGap} cumulative levels of maturity uplift; this is the engagement's primary investment thesis.`;
  } else if (bandKey === "Sustain") {
    actionTitle = `${capabilities.length} capabilities operate at target maturity; steady-state operations preserve capacity for higher-priority lift programmes.`;
  } else if (bandKey === "Invest") {
    actionTitle = `${capabilities.length} CRITICAL/HIGH capabilities at MANAGED maturity (${top2.join(" and ")}) are positioned to lead the industry; pushing to OPTIMIZING is the forward investment case.`;
  } else {
    // Reassess
    actionTitle = `${capabilities.length} capabilities (${top2.join(" and ")}) are over-served relative to strategic importance; redirect investment capacity to higher-priority gaps.`;
  }
  children.push(buildActionTitle(actionTitle, brandHex));

  // Governing thought (bold paragraph)
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
      children: [
        new TextRun({
          text: narrative.action,
          italics: true,
          size: 22,
        }),
      ],
    })
  );

  // Capabilities table — with status pills on importance + maturity columns.
  children.push(buildBandCapabilitiesTable(capabilities, brandHex));
}

function buildBandCapabilitiesTable(
  capabilities: CapabilityWithGap[],
  brandHex: string
): Table {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const headerBottom = {
    style: BorderStyle.SINGLE,
    size: 12,
    color: brandHex,
  };
  const widths = [28, 16, 12, 12, 12, 8, 12];
  const headers = [
    "Capability",
    "L1 Domain",
    "Importance",
    "Current",
    "Target",
    "Gap",
    "Apps mapped",
  ];
  const headerCells = headers.map(
    (h, i) =>
      new TableCell({
        width: { size: widths[i]!, type: WidthType.PERCENTAGE },
        shading: { fill: "FFFFFF" },
        borders: {
          top: noBorder,
          bottom: headerBottom,
          left: noBorder,
          right: noBorder,
        },
        children: [
          new Paragraph({
            alignment: i === 5 || i === 6 ? AlignmentType.RIGHT : AlignmentType.LEFT,
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({
                text: h,
                bold: true,
                size: T.small,
                color: clampForContrast({ hex: brandHex }),
              }),
            ],
          }),
        ],
      })
  );

  const bodyRows = capabilities.map((c, rowIdx) => {
    const baseFill = rowIdx % 2 === 1 ? "FAFAFA" : "FFFFFF";
    return new TableRow({
      children: [
        cellText({ text: c.name, fill: baseFill, align: AlignmentType.LEFT }),
        cellText({ text: c.l1Name, fill: baseFill, align: AlignmentType.LEFT }),
        buildStatusPillCell({
          text: c.strategicImportance.replace(/_/g, " "),
          tone: importanceToTone(c.strategicImportance),
        }),
        buildStatusPillCell({
          text: c.currentMaturity.replace(/_/g, " "),
          tone: maturityToTone(c.currentMaturity),
        }),
        buildStatusPillCell({
          text: c.targetMaturity.replace(/_/g, " "),
          tone: maturityToTone(c.targetMaturity),
        }),
        cellText({
          text: c.gapLevels === null ? "—" : (c.gapLevels > 0 ? `+${c.gapLevels}` : String(c.gapLevels)),
          fill: baseFill,
          align: AlignmentType.RIGHT,
          font: "Consolas",
        }),
        cellText({
          text: String(c.appsMappedCount),
          fill: baseFill,
          align: AlignmentType.RIGHT,
          font: "Consolas",
        }),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: noBorder,
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
      insideHorizontal: noBorder,
      insideVertical: noBorder,
    },
    rows: [
      new TableRow({ tableHeader: true, children: headerCells }),
      ...bodyRows,
    ],
  });
}

/** Per-capability deep-dive section. Hero box + capability mapping
 *  + LLM rationale + recommended path + wave. */
function pushDeepDiveSection(
  children: Array<Paragraph | Table>,
  cap: CapabilityWithGap,
  dive: DeepDive | null,
  brandHex: string
): void {
  children.push(buildHeading(cap.name, HeadingLevel.HEADING_1, brandHex));

  children.push(
    buildActionTitle(
      `${cap.strategicImportance.replace(/_/g, " ")} importance, ${cap.currentMaturity.replace(/_/g, " ")} → ${cap.targetMaturity.replace(/_/g, " ")} (gap ${cap.gapLevels === null ? "—" : (cap.gapLevels > 0 ? `+${cap.gapLevels}` : String(cap.gapLevels))} levels), ${cap.l1Name} domain, ${cap.appsMappedCount} application${cap.appsMappedCount === 1 ? "" : "s"} mapped.`,
      brandHex
    )
  );

  // Hero KPI row
  children.push(
    buildKpiRow({
      brandHex,
      tiles: [
        {
          value: cap.strategicImportance.replace(/_/g, " "),
          label: "Importance",
        },
        {
          value: cap.currentMaturity.replace(/_/g, " "),
          label: "Current",
        },
        {
          value: cap.targetMaturity.replace(/_/g, " "),
          label: "Target",
        },
        {
          value: cap.gapLevels === null ? "—" : `${cap.gapLevels > 0 ? "+" : ""}${cap.gapLevels}`,
          label: "Gap (levels)",
        },
        {
          value: String(cap.appsMappedCount),
          label: "Apps mapped",
        },
        {
          value: cap.l1Name.length > 18 ? cap.l1Name.slice(0, 16) + "…" : cap.l1Name,
          label: "L1 domain",
        },
      ],
    })
  );

  // Application coverage with TIME dispositions (cross-deliverable bridge)
  if (cap.appsMapped.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 80 },
        children: [
          new TextRun({
            text: "Application coverage (linked rationalization)",
            bold: true,
            color: clampForContrast({ hex: brandHex }),
            size: T.body,
          }),
        ],
      })
    );
    for (const app of cap.appsMapped) {
      const dispoLabel = app.rationalizationStatus
        ? ` — disposition: ${app.rationalizationStatus}`
        : "";
      const lifecycleLabel = ` (${app.lifecycle.replace(/_/g, " ")})`;
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 40 },
          children: [
            new TextRun({ text: app.name, bold: true, size: T.body }),
            new TextRun({
              text: `${dispoLabel}${lifecycleLabel}`,
              size: T.body,
              color: "4B5563",
            }),
          ],
        })
      );
    }
  } else {
    children.push(
      buildCallout({
        title: "No application mapped",
        tone: "warn",
        bullets: [
          "Capability lift requires standing up dedicated tooling — different programme economics than uplifting an existing app.",
        ],
        brandHex,
      })
    );
  }

  // LLM-grounded rationale
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
        children: [
          new TextRun({
            text: dive.waveJustification,
            italics: true,
            size: T.body,
          }),
        ],
      })
    );
  }
}

/** Wave-sequencing roadmap section. Deterministic placement
 *  per the heuristic in the design. */
function pushWaveSequencing(
  children: Array<Paragraph | Table>,
  m: CapabilityMaturityMetrics,
  brandHex: string
): void {
  // Apply the wave heuristic deterministically.
  const now: CapabilityWithGap[] = [];
  const next: CapabilityWithGap[] = [];
  const later: CapabilityWithGap[] = [];

  for (const cap of m.bands.liftToTarget) {
    if (
      cap.strategicImportance === "CRITICAL" &&
      (cap.currentMaturity === "INITIAL" ||
        cap.currentMaturity === "DEVELOPING") &&
      cap.appsMappedCount > 0
    ) {
      now.push(cap);
    } else if (
      cap.strategicImportance === "HIGH" ||
      (cap.strategicImportance === "CRITICAL" && cap.appsMappedCount === 0)
    ) {
      next.push(cap);
    } else {
      later.push(cap);
    }
  }
  for (const cap of m.bands.investBeyondTarget) {
    later.push(cap);
  }

  const total = now.length + next.length + later.length;
  if (total === 0) {
    children.push(
      buildActionTitle(
        "No priority capabilities require wave sequencing in this snapshot.",
        brandHex
      )
    );
    return;
  }

  children.push(
    buildActionTitle(
      `${now.length} of ${total} capabilities sit in the NOW horizon (<12 months); their sequencing anchors change-fatigue management across the downstream waves.`,
      brandHex
    )
  );

  const rows: string[][] = [];
  for (const cap of now) {
    rows.push([
      cap.name,
      cap.l1Name,
      "NOW (<12mo)",
      `${cap.gapLevels !== null && cap.gapLevels > 0 ? "+" + cap.gapLevels : "—"}`,
    ]);
  }
  for (const cap of next) {
    rows.push([
      cap.name,
      cap.l1Name,
      "NEXT (12–24mo)",
      `${cap.gapLevels !== null && cap.gapLevels > 0 ? "+" + cap.gapLevels : "—"}`,
    ]);
  }
  for (const cap of later) {
    rows.push([
      cap.name,
      cap.l1Name,
      "LATER (24–36mo)",
      `${cap.gapLevels !== null && cap.gapLevels > 0 ? "+" + cap.gapLevels : "—"}`,
    ]);
  }

  children.push(
    buildTable({
      headers: ["Capability", "L1 Domain", "Wave", "Gap (levels)"],
      rows,
      brandHex,
      columnWidthsPct: [38, 22, 24, 16],
      numericColumns: [3],
    })
  );
}

/** Risks section — workspace-specific risks + canonical maturity risks. */
function pushRisksSection(
  children: Array<Paragraph | Table>,
  m: CapabilityMaturityMetrics,
  brandHex: string
): void {
  const portfolioRisks: string[][] = [];

  const ws = m.workspaceSpecificRisks;
  if (ws.criticalAtInitialOrDeveloping.count > 0) {
    portfolioRisks.push([
      `${ws.criticalAtInitialOrDeveloping.count} CRITICAL capabilities sit at INITIAL or DEVELOPING maturity (${ws.criticalAtInitialOrDeveloping.capabilities.slice(0, 2).join(", ")}${ws.criticalAtInitialOrDeveloping.capabilities.length > 2 ? ", …" : ""})`,
      "H",
      "H",
      "Sequence Wave-1 lift on the priority cluster; assign business + IT owners pre-commit; gate FY budget on owner accountability.",
    ]);
  }

  if (ws.topUnassessedL1) {
    portfolioRisks.push([
      `${ws.topUnassessedL1.l1Name} domain shows ${Math.round(ws.topUnassessedL1.share * 100)}% NOT_ASSESSED — coverage gap blocks investment case framing for that domain`,
      "H",
      "M",
      "Run an assessment workshop with capability owners in the Wave-1 prep period; coverage gap closure is a precondition to budget commit.",
    ]);
  }

  if (ws.capabilitiesWithoutOwners.count > 0) {
    portfolioRisks.push([
      `${ws.capabilitiesWithoutOwners.count} capabilities lack a business + IT owner pair — accountability gap blocks Wave-1 commit`,
      "M",
      "H",
      "Assign a business owner and IT owner to every CRITICAL/HIGH capability before the next portfolio review.",
    ]);
  }

  const allRows: string[][] = [
    ...portfolioRisks,
    [
      "Maturity ratings are opinion-grade until evidenced",
      "H",
      "M",
      "Multi-stakeholder calibration on top-priority capabilities before commitment.",
    ],
    [
      "Capability uplift dependency chain — lifting A wastes spend without lifting B first",
      "M",
      "H",
      "Dependency-aware sequencing using the CapabilityDependency graph; load-test the dependency map.",
    ],
    [
      "Application-readiness mismatch on orphaned capabilities",
      "M",
      "H",
      "Bundle orphaned capability lifts with rationalization-track new-tool decisions.",
    ],
    [
      "Strategic importance drift between assessment and execution",
      "L",
      "M",
      "Re-assess strategic importance every 6 months on the top-N priority lift candidates.",
    ],
    [
      "NOT_ASSESSED debt on the long tail",
      "M",
      "M",
      "Assess-first, plan-second sequencing for the NOT_ASSESSED tail; revisit the deliverable after coverage clears 80%.",
    ],
  ];

  if (portfolioRisks.length > 0) {
    children.push(
      buildActionTitle(
        `${portfolioRisks.length} portfolio-specific risk${portfolioRisks.length === 1 ? "" : "s"} sit above the canonical five; CRITICAL maturity exposure, coverage gaps, and ownership accountability frame the workspace-grounded watch-list.`,
        brandHex
      )
    );
  } else {
    children.push(
      buildActionTitle(
        "Five canonical risks attend any maturity assessment programme; mitigation owners are placeholders for engagement-team override.",
        brandHex
      )
    );
  }

  children.push(
    buildTable({
      headers: ["Risk", "Likelihood", "Impact", "Mitigation"],
      rows: allRows,
      brandHex,
      columnWidthsPct: [40, 12, 12, 36],
      numericColumns: [1, 2],
    })
  );
}

/** Next Steps table. */
function buildNextStepsTable(
  m: CapabilityMaturityMetrics,
  brandHex: string
): Table {
  const liftCount = m.bands.liftToTarget.length;
  const reassessCount = m.bands.reassessStrategy.length;
  const investBeyondCount = m.bands.investBeyondTarget.length;

  return buildTable({
    headers: ["Action", "Owner", "Due", "Dependency"],
    rows: [
      [
        `Validate the ${liftCount} priority lift candidates with capability owners`,
        "[Capability Lead]",
        "Week 2",
        "Capability ownership map",
      ],
      [
        `Confirm application-coverage signal for top-priority capabilities`,
        "[Architecture Team]",
        "Week 3",
        "Application portfolio map",
      ],
      [
        `Run assessment workshop on NOT_ASSESSED capabilities`,
        "[Capability Lead]",
        "Week 4",
        "Capability owner availability",
      ],
      [
        `Review the ${investBeyondCount} invest-beyond-target candidates`,
        "[Programme Sponsor]",
        "Week 6",
        "FY budget cycle calendar",
      ],
      [
        `Steerco review of the wave-sequencing roadmap`,
        "[Programme Sponsor]",
        "Week 8",
        "Above artefacts complete",
      ],
      [
        `Reassess investment on ${reassessCount} over-served capabilities`,
        "[Programme Lead]",
        "Week 10",
        "Steerco approval",
      ],
    ],
    brandHex,
    columnWidthsPct: [44, 18, 12, 26],
  });
}

/** Appendix A — full capability listing. */
function pushAppendixA(
  children: Array<Paragraph | Table>,
  m: CapabilityMaturityMetrics,
  brandHex: string
): void {
  // Combine all capabilities across bands, sorted by L1 then by name.
  const all: CapabilityWithGap[] = [
    ...m.bands.liftToTarget,
    ...m.bands.investBeyondTarget,
    ...m.bands.sustainAtTarget,
    ...m.bands.reassessStrategy,
    ...m.bands.notAssessed,
  ];
  all.sort((a, b) => {
    if (a.l1Name !== b.l1Name) return a.l1Name.localeCompare(b.l1Name);
    return a.name.localeCompare(b.name);
  });

  if (all.length === 0) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: renderInline("*No capabilities in this workspace yet.*"),
      })
    );
    return;
  }

  children.push(
    buildTable({
      headers: ["Capability", "L1 Domain", "Importance", "Current", "Target", "Apps"],
      rows: all.map((c) => [
        c.name,
        c.l1Name,
        c.strategicImportance.replace(/_/g, " "),
        c.currentMaturity.replace(/_/g, " "),
        c.targetMaturity.replace(/_/g, " "),
        String(c.appsMappedCount),
      ]),
      brandHex,
      columnWidthsPct: [30, 22, 14, 14, 14, 6],
      numericColumns: [5],
    })
  );
}

/** Appendix B — methodology + data lineage. */
function pushAppendixB(
  children: Array<Paragraph | Table>,
  m: CapabilityMaturityMetrics,
  today: string
): void {
  children.push(
    new Paragraph({
      spacing: { after: 120, line: 320 },
      children: renderInline(
        `This deliverable was generated on ${today} from the live capability portfolio in the EAM platform. Counts and maturity ratings reflect the values stored on each Capability record at the time of generation; the source fields are *currentMaturity*, *targetMaturity*, *strategicImportance*, *level* (L1/L2/L3), *parentId*, *businessOwnerId*, *itOwnerId*, and the application-capability mapping table.`
      ),
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 120, line: 320 },
      children: renderInline(
        `**Maturity numeric scale.** INITIAL=1, DEVELOPING=2, DEFINED=3, MANAGED=4, OPTIMIZING=5. NOT_ASSESSED is excluded from weighted-mean computations (capability is unknown, not zero).`
      ),
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 120, line: 320 },
      children: renderInline(
        `**Action-class banding rules.** LIFT_TO_TARGET = current<target AND importance ∈ {CRITICAL, HIGH}. SUSTAIN = current=target with no invest-beyond flag. INVEST_BEYOND_TARGET = CRITICAL/HIGH at MANAGED, candidate for OPTIMIZING. REASSESS_STRATEGY = current>target OR (OPTIMIZING + LOW importance). NOT_ASSESSED = current or target = NOT_ASSESSED.`
      ),
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 120, line: 320 },
      children: renderInline(
        `**Wave heuristic.** NOW (<12mo): CRITICAL importance + INITIAL/DEVELOPING + apps mapped. NEXT (12-24mo): HIGH importance + DEVELOPING/DEFINED, OR CRITICAL but orphaned. LATER (24-36mo): MEDIUM importance gaps + INVEST_BEYOND_TARGET candidates.`
      ),
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 120, line: 320 },
      children: renderInline(
        `**Top-N selection (deep dives).** Composite priorityWeight = |gapLevels| × importanceWeight × log(1 + appCount). Importance weights: CRITICAL=4, HIGH=3, MEDIUM=2, LOW=1, NOT_ASSESSED=0.`
      ),
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 120, line: 320 },
      children: renderInline(
        `**What this assessment is not.** This deliverable quantifies capability gap-levels and sequencing, NOT investment cost. Cost estimation requires per-capability investment data not currently captured in the schema. Peer benchmarking, process re-engineering recommendations, skills/team-capability assessments, and competitor maturity comparisons are explicitly out of scope. The Investment Roadmap sequences action; pricing the action requires a downstream costing exercise.`
      ),
    })
  );

  // Suppress unused
  void m;
}

/** Appendix C — glossary. */
function buildGlossaryTable(brandHex: string): Table {
  return buildTable({
    headers: ["Term", "Definition"],
    rows: [
      [
        "Maturity scale",
        "INITIAL → DEVELOPING → DEFINED → MANAGED → OPTIMIZING. NOT_ASSESSED is a separate state (unknown, not zero).",
      ],
      [
        "Strategic importance",
        "CRITICAL, HIGH, MEDIUM, LOW, NOT_ASSESSED. Independent scale from maturity; used to prioritize lift sequencing.",
      ],
      [
        "Gap (levels)",
        "Numeric difference between targetMaturity and currentMaturity (1-5 scale). Positive = lift required; negative = over-served. Null when either side is NOT_ASSESSED.",
      ],
      [
        "L1 / L2 / L3",
        "Capability hierarchy levels. L1 = top-level domains; L2 = sub-capabilities under L1; L3 = leaf-level capabilities under L2.",
      ],
      [
        "Lift to Target band",
        "Capabilities at CRITICAL or HIGH importance with current<target. The investment thesis lives here.",
      ],
      [
        "Sustain at Target band",
        "Capabilities at current=target with no flag for invest-beyond. Steady-state operations.",
      ],
      [
        "Invest Beyond Target band",
        "CRITICAL/HIGH capabilities at current=target=MANAGED. Candidates for pushing to OPTIMIZING — lead-the-industry positioning.",
      ],
      [
        "Reassess Strategy band",
        "Capabilities at current>target OR (OPTIMIZING + LOW importance). Over-served — investment is out of proportion to strategic value.",
      ],
      [
        "NOT_ASSESSED callout",
        "Capabilities lacking current or target maturity assessment. Investment case cannot be framed until assessed.",
      ],
      [
        "Wave",
        "NOW (<12mo) / NEXT (12-24mo) / LATER (24-36mo). Strategic importance + current maturity + application-readiness drive placement.",
      ],
      [
        "Capability-application coverage",
        "Bridge to the Application Rationalization Plan: each capability's mapped applications and their TIME dispositions (TOLERATE / INVEST / MIGRATE / ELIMINATE) co-reference across deliverables.",
      ],
    ],
    brandHex,
    columnWidthsPct: [22, 78],
  });
}

// ─── Cell helpers (mirror rationalization builder patterns) ───

function cellText(opts: {
  text: string;
  fill: string;
  align: typeof AlignmentType[keyof typeof AlignmentType];
  font?: string;
}): TableCell {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return new TableCell({
    shading: { fill: opts.fill },
    borders: {
      top: noBorder,
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
    },
    children: [
      new Paragraph({
        alignment: opts.align,
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({ text: opts.text, size: T.small, font: opts.font }),
        ],
      }),
    ],
  });
}

// ─── Facts builders for LLM calls ─────────────────────────────

type ExecSummaryFacts = {
  clientName: string;
  totalCapabilities: number;
  assessmentCoverageRatio: number;
  liftToTargetCount: number;
  cumulativeGapLevels: number;
  topL1: { name: string; gapLevels: number; childCount: number } | null;
  byImportance: Record<string, number>;
  byCurrentMaturity: Record<string, number>;
  bandSizes: { lift: number; sustain: number; investBeyond: number; reassess: number; notAssessed: number };
  topGaps3: string[];
  appReadinessShare: number;
};

function buildExecSummaryFacts(
  m: CapabilityMaturityMetrics,
  clientName: string
): ExecSummaryFacts {
  const liftToTarget = m.bands.liftToTarget;
  const cumulativeGap = liftToTarget.reduce(
    (s, c) => s + (c.gapLevels ?? 0),
    0
  );
  const withApps = liftToTarget.filter((c) => c.appsMappedCount > 0).length;
  const top1 = m.l1Rollups[0];
  return {
    clientName,
    totalCapabilities: m.totalCapabilities,
    assessmentCoverageRatio: m.assessmentCoverageRatio,
    liftToTargetCount: liftToTarget.length,
    cumulativeGapLevels: cumulativeGap,
    topL1: top1
      ? {
          name: top1.l1Name,
          gapLevels: top1.totalGapLevels,
          childCount: top1.childCount,
        }
      : null,
    byImportance: m.byStrategicImportance,
    byCurrentMaturity: m.byCurrentMaturity,
    bandSizes: {
      lift: m.bands.liftToTarget.length,
      sustain: m.bands.sustainAtTarget.length,
      investBeyond: m.bands.investBeyondTarget.length,
      reassess: m.bands.reassessStrategy.length,
      notAssessed: m.bands.notAssessed.length,
    },
    topGaps3: liftToTarget.slice(0, 3).map((c) => c.name),
    appReadinessShare:
      liftToTarget.length > 0 ? withApps / liftToTarget.length : 0,
  };
}

type KeyFindingsFacts = ExecSummaryFacts & {
  workspaceSpecificRisks: CapabilityMaturityMetrics["workspaceSpecificRisks"];
  topUnassessedL1: CapabilityMaturityMetrics["topUnassessedL1"];
};

function buildKeyFindingsFacts(
  m: CapabilityMaturityMetrics,
  clientName: string
): KeyFindingsFacts {
  return {
    ...buildExecSummaryFacts(m, clientName),
    workspaceSpecificRisks: m.workspaceSpecificRisks,
    topUnassessedL1: m.topUnassessedL1,
  };
}

type BandNarrativesFacts = {
  clientName: string;
  bands: {
    LIFT_TO_TARGET: BandFactsBlock;
    SUSTAIN: BandFactsBlock;
    INVEST_BEYOND_TARGET: BandFactsBlock;
    REASSESS_STRATEGY: BandFactsBlock;
  };
};

type BandFactsBlock = {
  count: number;
  cumulativeGap: number;
  top5: Array<{
    name: string;
    l1Name: string;
    importance: string;
    current: string;
    target: string;
    gap: number | null;
    appsMappedCount: number;
    apps: string[];
  }>;
};

function buildBandNarrativesFacts(
  m: CapabilityMaturityMetrics,
  clientName: string
): BandNarrativesFacts {
  const block = (caps: CapabilityWithGap[]): BandFactsBlock => ({
    count: caps.length,
    cumulativeGap: caps.reduce((s, c) => s + Math.abs(c.gapLevels ?? 0), 0),
    top5: caps.slice(0, 5).map((c) => ({
      name: c.name,
      l1Name: c.l1Name,
      importance: c.strategicImportance,
      current: c.currentMaturity,
      target: c.targetMaturity,
      gap: c.gapLevels,
      appsMappedCount: c.appsMappedCount,
      apps: c.appsMapped.slice(0, 3).map((a) => a.name),
    })),
  });

  return {
    clientName,
    bands: {
      LIFT_TO_TARGET: block(m.bands.liftToTarget),
      SUSTAIN: block(m.bands.sustainAtTarget),
      INVEST_BEYOND_TARGET: block(m.bands.investBeyondTarget),
      REASSESS_STRATEGY: block(m.bands.reassessStrategy),
    },
  };
}

type DeepDivesFacts = {
  clientName: string;
  capabilities: Array<{
    id: string;
    name: string;
    l1Name: string;
    level: string;
    importance: string;
    current: string;
    target: string;
    gap: number | null;
    appsMappedCount: number;
    appsMapped: Array<{
      name: string;
      rationalizationStatus: string | null;
      lifecycle: string;
    }>;
    hasBusinessOwner: boolean;
    hasItOwner: boolean;
  }>;
};

function buildDeepDivesFacts(
  caps: CapabilityWithGap[],
  clientName: string
): DeepDivesFacts {
  return {
    clientName,
    capabilities: caps.map((c) => ({
      id: c.id,
      name: c.name,
      l1Name: c.l1Name,
      level: c.level,
      importance: c.strategicImportance,
      current: c.currentMaturity,
      target: c.targetMaturity,
      gap: c.gapLevels,
      appsMappedCount: c.appsMappedCount,
      appsMapped: c.appsMapped.slice(0, 5),
      hasBusinessOwner: c.hasBusinessOwner,
      hasItOwner: c.hasItOwner,
    })),
  };
}

// ─── LLM call wrappers (with deterministic fallback) ─────────

function collectAllowedCounts(m: CapabilityMaturityMetrics): number[] {
  const out = new Set<number>();
  out.add(m.totalCapabilities);
  for (const v of Object.values(m.byCurrentMaturity)) out.add(v);
  for (const v of Object.values(m.byTargetMaturity)) out.add(v);
  for (const v of Object.values(m.byStrategicImportance)) out.add(v);
  out.add(m.bands.liftToTarget.length);
  out.add(m.bands.sustainAtTarget.length);
  out.add(m.bands.investBeyondTarget.length);
  out.add(m.bands.reassessStrategy.length);
  out.add(m.bands.notAssessed.length);
  out.add(Math.round(m.assessmentCoverageRatio * 100));
  for (const r of m.l1Rollups) {
    out.add(r.childCount);
    out.add(r.totalGapLevels);
    out.add(r.unassessedCount);
  }
  out.add(
    m.bands.liftToTarget.reduce((s, c) => s + (c.gapLevels ?? 0), 0)
  );
  return Array.from(out);
}

async function generateExecSummary(
  facts: ExecSummaryFacts,
  allowedCounts: number[],
  m: CapabilityMaturityMetrics,
  clientName: string
): Promise<{ source: "llm" | "deterministic_fallback"; result: ExecSummaryResult }> {
  if (facts.totalCapabilities === 0) {
    return {
      source: "deterministic_fallback",
      result: { text: deterministicExecFallback(facts) },
    };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL_SONNET,
        max_tokens: 1500,
        system: CAPABILITY_MATURITY_EXEC_SUMMARY_PROMPT,
        messages: [
          {
            role: "user",
            content: `Facts:\n${JSON.stringify(facts, null, 2)}\n\nReturn JSON only.`,
          },
        ],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      const raw = textBlock && "text" in textBlock ? (textBlock.text as string) : "";
      const parsed = parseJsonish(raw);
      const text = (parsed as { executiveSummary?: string }).executiveSummary?.trim();
      if (!text) continue;
      if (!verifyMaturityNumbers(text, allowedCounts)) {
        console.warn(JSON.stringify({ evt: "maturity_exec_fact_mismatch", attempt }));
        continue;
      }
      return { source: "llm", result: { text } };
    } catch (err) {
      console.warn(JSON.stringify({ evt: "maturity_exec_llm_error", attempt, message: String(err) }));
    }
  }
  return {
    source: "deterministic_fallback",
    result: { text: deterministicExecFallback(facts) },
  };
  // suppress
  void m;
  void clientName;
}

function deterministicExecFallback(facts: ExecSummaryFacts): string {
  const lines: string[] = [];
  const coveragePct = Math.round(facts.assessmentCoverageRatio * 100);
  lines.push(
    `Findings indicate the ${facts.clientName} capability portfolio comprises ${facts.totalCapabilities} capabilities at ${coveragePct}% assessment coverage. ${facts.bandSizes.lift} require uplift on the priority lift band, carrying ${facts.cumulativeGapLevels} cumulative maturity-level gaps; ${facts.bandSizes.investBeyond} CRITICAL/HIGH capabilities sit at MANAGED maturity and warrant beyond-target investment to lead-the-industry positioning.`
  );
  if (facts.topL1) {
    lines.push(
      `${facts.topL1.name} owns the largest L1 domain investment ask at ${facts.topL1.gapLevels} cumulative gap-levels across ${facts.topL1.childCount} L2/L3 capabilities. ${Math.round(facts.appReadinessShare * 100)}% of priority-lift capabilities have applications mapped (execution-ready); the orphaned remainder requires tooling stand-up before the capability lift can commit.`
    );
  }
  lines.push(
    `The Investment Roadmap below sequences the priority lift across NOW / NEXT / LATER waves; the Capability Deep Dives extend the case for the top ${Math.min(5, facts.bandSizes.lift)} priority capabilities.`
  );
  return lines.join("\n\n");
}

async function generateKeyFindings(
  facts: KeyFindingsFacts,
  allowedCounts: number[],
  m: CapabilityMaturityMetrics
): Promise<{ source: "llm" | "deterministic_fallback"; result: KeyFindingsResult }> {
  if (facts.totalCapabilities === 0) {
    return {
      source: "deterministic_fallback",
      result: { findings: deterministicKeyFindingsFallback(facts) },
    };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL_SONNET,
        max_tokens: 1800,
        system: CAPABILITY_MATURITY_KEY_FINDINGS_PROMPT,
        messages: [
          {
            role: "user",
            content: `Facts:\n${JSON.stringify(facts, null, 2)}\n\nReturn JSON only.`,
          },
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
        console.warn(JSON.stringify({ evt: "maturity_findings_fact_mismatch", attempt }));
        continue;
      }
      return { source: "llm", result: { findings } };
    } catch (err) {
      console.warn(JSON.stringify({ evt: "maturity_findings_llm_error", attempt, message: String(err) }));
    }
  }
  return {
    source: "deterministic_fallback",
    result: { findings: deterministicKeyFindingsFallback(facts) },
  };
  void m;
}

function deterministicKeyFindingsFallback(facts: KeyFindingsFacts): KeyFinding[] {
  const out: KeyFinding[] = [];
  const coveragePct = Math.round(facts.assessmentCoverageRatio * 100);

  out.push({
    title: `${facts.bandSizes.lift} priority lift candidates anchor the FY capability investment plan`,
    body: `${facts.bandSizes.lift} capabilities at CRITICAL or HIGH strategic importance carry ${facts.cumulativeGapLevels} cumulative maturity-level gaps. ${Math.round(facts.appReadinessShare * 100)}% have applications mapped, signalling immediate execution-readiness for Wave-1 commitment. The priority cohort defines the engagement's primary investment thesis.`,
  });

  if (facts.topL1) {
    out.push({
      title: `${facts.topL1.name} domain owns the largest cumulative maturity gap`,
      body: `${facts.topL1.name} carries ${facts.topL1.gapLevels} cumulative gap-levels across ${facts.topL1.childCount} L2/L3 capabilities — the largest single domain investment ask. Concentration of this magnitude warrants a dedicated programme stream rather than distributed investment across L1 domains.`,
    });
  }

  if (coveragePct < 80) {
    out.push({
      title: `${100 - coveragePct}% of capabilities remain NOT_ASSESSED — coverage gap blocks investment case framing`,
      body: `Assessment coverage stands at ${coveragePct}%. Capability owners must complete maturity ratings before the investment case for the unassessed tail can be framed. Sequence assessment workshops in the Wave-1 prep period; coverage gap closure is a precondition to budget commit.`,
    });
  }

  if (facts.bandSizes.investBeyond > 0) {
    out.push({
      title: `${facts.bandSizes.investBeyond} capabilities position for industry-leading investment`,
      body: `${facts.bandSizes.investBeyond} CRITICAL or HIGH-importance capabilities sit at MANAGED maturity and are positioned to push to OPTIMIZING. The forward-investment case anchors the FY+1 plan after the Wave-1 lift cohort lands.`,
    });
  }

  if (facts.bandSizes.reassess > 0) {
    out.push({
      title: `${facts.bandSizes.reassess} capabilities warrant investment rebalancing`,
      body: `${facts.bandSizes.reassess} capabilities are over-served relative to strategic importance. Redirect capacity from these areas to the priority lift programme; acknowledge prior investment as past-tense fact while reallocating going forward.`,
    });
  }

  while (out.length < 5) {
    out.push({
      title: `${facts.totalCapabilities} capabilities define the assessment scope`,
      body: `The portfolio spans ${facts.totalCapabilities} capabilities across the L1/L2/L3 hierarchy. Coverage and consistency across the hierarchy determine how much of the investment case can be framed quantitatively versus qualitatively.`,
    });
    break;
  }
  return out.slice(0, 5);
}

async function generateBandNarratives(
  facts: BandNarrativesFacts,
  allowedCounts: number[],
  m: CapabilityMaturityMetrics
): Promise<{ source: "llm" | "deterministic_fallback"; result: BandNarrativesResult }> {
  const totalCount =
    facts.bands.LIFT_TO_TARGET.count +
    facts.bands.SUSTAIN.count +
    facts.bands.INVEST_BEYOND_TARGET.count +
    facts.bands.REASSESS_STRATEGY.count;
  if (totalCount === 0) {
    return {
      source: "deterministic_fallback",
      result: { narratives: deterministicBandFallback(facts, m) },
    };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL_SONNET,
        max_tokens: 2500,
        system: CAPABILITY_MATURITY_BAND_NARRATIVES_PROMPT,
        messages: [
          {
            role: "user",
            content: `Facts:\n${JSON.stringify(facts, null, 2)}\n\nReturn JSON only.`,
          },
        ],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      const raw = textBlock && "text" in textBlock ? (textBlock.text as string) : "";
      const parsed = parseJsonish(raw) as Partial<AllBandNarratives>;
      const narratives = normalizeBandNarratives(parsed);
      if (!narratives) continue;
      const allText = (
        ["LIFT_TO_TARGET", "SUSTAIN", "INVEST_BEYOND_TARGET", "REASSESS_STRATEGY"] as const
      )
        .map((k) => `${narratives[k].governingThought} ${narratives[k].whyNow.join(" ")} ${narratives[k].whatItMeans} ${narratives[k].action}`)
        .join(" ");
      if (!verifyMaturityNumbers(allText, allowedCounts)) {
        console.warn(JSON.stringify({ evt: "maturity_bands_fact_mismatch", attempt }));
        continue;
      }
      return { source: "llm", result: { narratives } };
    } catch (err) {
      console.warn(JSON.stringify({ evt: "maturity_bands_llm_error", attempt, message: String(err) }));
    }
  }
  return {
    source: "deterministic_fallback",
    result: { narratives: deterministicBandFallback(facts, m) },
  };
}

function normalizeBandNarratives(
  parsed: Partial<AllBandNarratives>
): AllBandNarratives | null {
  const keys = ["LIFT_TO_TARGET", "SUSTAIN", "INVEST_BEYOND_TARGET", "REASSESS_STRATEGY"] as const;
  const out: Partial<AllBandNarratives> = {};
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
    out[k] = {
      governingThought: b.governingThought,
      whyNow: [
        String(b.whyNow[0] ?? "—"),
        String(b.whyNow[1] ?? "—"),
        String(b.whyNow[2] ?? "—"),
      ],
      whatItMeans: b.whatItMeans,
      action: b.action,
    };
  }
  return out as AllBandNarratives;
}

function deterministicBandFallback(
  facts: BandNarrativesFacts,
  m: CapabilityMaturityMetrics
): AllBandNarratives {
  const mk = (block: BandFactsBlock, kind: string): BandNarrative => {
    if (block.count === 0) {
      return {
        governingThought: "—",
        whyNow: ["—", "—", "—"],
        whatItMeans: "—",
        action: "—",
      };
    }
    const top2 = block.top5.slice(0, 2).map((c) => c.name);
    return {
      governingThought: `${block.count} capabilities sit in the ${kind} band, carrying ${block.cumulativeGap} cumulative gap-levels.`,
      whyNow: [
        `Top capabilities by priority weight: ${top2.join(", ")}.`,
        `Average gap across the band: ${block.count > 0 ? (block.cumulativeGap / block.count).toFixed(1) : "0"} levels.`,
        `Engagement team validates the band membership before commitment.`,
      ],
      whatItMeans: `Investment in this band aligns with the action class. Sequencing and ownership accountability gate execution.`,
      action: `Sequence ${kind.toLowerCase()} actions per the wave heuristic; capability owners validate within 30 days.`,
    };
  };
  return {
    LIFT_TO_TARGET: mk(facts.bands.LIFT_TO_TARGET, "LIFT_TO_TARGET"),
    SUSTAIN: mk(facts.bands.SUSTAIN, "SUSTAIN"),
    INVEST_BEYOND_TARGET: mk(facts.bands.INVEST_BEYOND_TARGET, "INVEST_BEYOND_TARGET"),
    REASSESS_STRATEGY: mk(facts.bands.REASSESS_STRATEGY, "REASSESS_STRATEGY"),
  };
  void m;
}

async function generateDeepDives(
  facts: DeepDivesFacts,
  topApps: CapabilityWithGap[],
  allowedCounts: number[]
): Promise<{ source: "llm" | "deterministic_fallback"; result: DeepDivesResult }> {
  if (facts.capabilities.length === 0) {
    return { source: "deterministic_fallback", result: { byId: {} } };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL_SONNET,
        max_tokens: 2500,
        system: CAPABILITY_MATURITY_DEEP_DIVES_PROMPT,
        messages: [
          {
            role: "user",
            content: `Facts:\n${JSON.stringify(facts, null, 2)}\n\nReturn JSON only.`,
          },
        ],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      const raw = textBlock && "text" in textBlock ? (textBlock.text as string) : "";
      const parsed = parseJsonish(raw) as Record<string, Partial<DeepDive>>;
      const byId: Record<string, DeepDive> = {};
      let valid = 0;
      for (const cap of facts.capabilities) {
        const entry = parsed[cap.id];
        if (
          entry &&
          typeof entry.dispositionRationale === "string" &&
          typeof entry.recommendedPath === "string" &&
          typeof entry.waveJustification === "string"
        ) {
          byId[cap.id] = {
            dispositionRationale: entry.dispositionRationale,
            recommendedPath: entry.recommendedPath,
            waveJustification: entry.waveJustification,
          };
          valid++;
        }
      }
      if (valid < facts.capabilities.length) continue;
      const allText = Object.values(byId)
        .map(
          (d) =>
            `${d.dispositionRationale} ${d.recommendedPath} ${d.waveJustification}`
        )
        .join(" ");
      if (!verifyMaturityNumbers(allText, allowedCounts)) {
        console.warn(JSON.stringify({ evt: "maturity_deepdives_fact_mismatch", attempt }));
        continue;
      }
      return { source: "llm", result: { byId } };
    } catch (err) {
      console.warn(JSON.stringify({ evt: "maturity_deepdives_llm_error", attempt, message: String(err) }));
    }
  }
  // Deterministic fallback
  const byId: Record<string, DeepDive> = {};
  for (const cap of topApps) {
    byId[cap.id] = deterministicDeepDiveFallback(cap);
  }
  return { source: "deterministic_fallback", result: { byId } };
}

function deterministicDeepDiveFallback(cap: CapabilityWithGap): DeepDive {
  const gap =
    cap.gapLevels === null
      ? "unknown"
      : cap.gapLevels > 0
        ? `${cap.gapLevels}-level lift`
        : cap.gapLevels < 0
          ? `${Math.abs(cap.gapLevels)}-level over-served`
          : "at target";
  const appLine =
    cap.appsMappedCount === 0
      ? "no application mapped — capability lift requires standing up dedicated tooling"
      : `${cap.appsMappedCount} application${cap.appsMappedCount === 1 ? "" : "s"} mapped`;
  let recPath: string;
  if (cap.appsMappedCount === 0) {
    recPath = "Stand up dedicated tooling or a managed-platform replacement; pair with capability ownership assignment.";
  } else if (cap.currentMaturity === "INITIAL" || cap.currentMaturity === "DEVELOPING") {
    recPath = "Governance framework + measurement layer + center-of-excellence anchoring; execute through existing application stack.";
  } else {
    recPath = "Platform modernization paired with governance uplift; sequence around application-stack capacity.";
  }
  let wave: string;
  if (cap.strategicImportance === "CRITICAL" && (cap.currentMaturity === "INITIAL" || cap.currentMaturity === "DEVELOPING") && cap.appsMappedCount > 0) {
    wave = "NOW";
  } else if (cap.strategicImportance === "CRITICAL" && cap.appsMappedCount === 0) {
    wave = "NEXT";
  } else if (cap.strategicImportance === "HIGH") {
    wave = "NEXT";
  } else {
    wave = "LATER";
  }
  return {
    dispositionRationale: `${cap.name} sits in the ${cap.l1Name} domain at ${cap.strategicImportance.replace(/_/g, " ")} importance, currently at ${cap.currentMaturity.replace(/_/g, " ")} maturity targeting ${cap.targetMaturity.replace(/_/g, " ")} (${gap}); ${appLine}.`,
    recommendedPath: recPath,
    waveJustification: `Wave ${wave}: driven by ${cap.strategicImportance.replace(/_/g, " ")} importance and ${cap.currentMaturity.replace(/_/g, " ")} starting maturity.`,
  };
}

// ─── Shared parsing helper ───────────────────────────────────

function parseJsonish(raw: string): Record<string, unknown> {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence?.[1]?.trim() ?? raw.trim();
  try {
    return JSON.parse(candidate);
  } catch {
    return {};
  }
}

export {
  CAPABILITY_MATURITY_EXEC_SUMMARY_VERSION,
  CAPABILITY_MATURITY_KEY_FINDINGS_VERSION,
  CAPABILITY_MATURITY_BAND_NARRATIVES_VERSION,
  CAPABILITY_MATURITY_DEEP_DIVES_VERSION,
};
