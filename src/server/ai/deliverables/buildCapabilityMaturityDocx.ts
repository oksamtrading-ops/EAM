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
  /** 5 evidence bullets per band (was 3 in v1.0). */
  whyNow: string[];
  whatItMeans: string;
  /** What breaks if Wave-1 does not sequence on this band first.
   *  Literal "—" for SUSTAIN. New in density-lift v1.1. */
  counterfactual: string;
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
  /** Execution-risk surface + mitigation. New in density-lift v1.1. */
  riskProfile: string;
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
      `${liftCount} priority lift candidates anchor the timing; ${topL1?.l1Name ?? "the lead L1 domain"} concentration anchors the sequencing; the ${m.bands.investBeyondTarget.length} invest-beyond-target capabilit${m.bands.investBeyondTarget.length === 1 ? "y sets" : "ies set"} the trajectory.`,
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
    m.bands.liftToTarget,
    brandHex
  );
  pushBandSection(
    children,
    "Sustain at Target — Hold Position",
    bandNarratives.SUSTAIN,
    m.bands.sustainAtTarget,
    brandHex
  );
  pushBandSection(
    children,
    "Invest Beyond Target — Lead the Industry",
    bandNarratives.INVEST_BEYOND_TARGET,
    m.bands.investBeyondTarget,
    brandHex
  );
  pushBandSection(
    children,
    "Reassess Strategy — Rebalance Investment",
    bandNarratives.REASSESS_STRATEGY,
    m.bands.reassessStrategy,
    brandHex
  );

  // Monitor Tail — MEDIUM/LOW positive-gap capabilities outside
  // the priority investment thesis. Render as a compact callout
  // (not a full band section) — these don't drive the budget but
  // dropping them entirely would leave a gap in the listing.
  if (m.bands.monitorTail.length > 0) {
    children.push(
      buildCallout({
        title: `Monitor Tail — ${m.bands.monitorTail.length} MEDIUM/LOW capabilities with minor gaps`,
        tone: "info",
        bullets: [
          `${m.bands.monitorTail.length} capabilities at MEDIUM or LOW strategic importance show positive maturity gaps; out of scope for the priority investment thesis above.`,
          `Top of the tail: ${m.bands.monitorTail.slice(0, 3).map((c) => c.name).join(", ")}${m.bands.monitorTail.length > 3 ? `, +${m.bands.monitorTail.length - 3} more (see Appendix A)` : ""}.`,
          `Revisit at the next portfolio review; promote into Lift only if strategic importance is reassessed upward.`,
        ],
        brandHex,
      })
    );
  }

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
    actionTitle = `${capabilities.length} capabilit${capabilities.length === 1 ? "y" : "ies"} operate at target maturity (current = target); steady-state operations preserve capacity for higher-priority lift programmes.`;
  } else if (bandKey === "Invest") {
    actionTitle = `${capabilities.length} CRITICAL/HIGH capabilit${capabilities.length === 1 ? "y" : "ies"} at MANAGED maturity (${top2.join(" and ")}) ${capabilities.length === 1 ? "is" : "are"} positioned to lead the industry; pushing to OPTIMIZING is the forward investment case.`;
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

  // Counterfactual — what breaks if Wave-1 skips this band.
  // Suppressed when LLM/fallback emits "—" (SUSTAIN; empty bands).
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
            text: "If Wave-1 skips this band",
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

    // Risk profile — execution-risk surface + mitigation.
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
    // When *every* capability lacks an owner pair, the signal is
    // a data-collection gap (no ownership ever recorded), not a
    // portfolio risk per se. Reframe so partner-readers don't
    // discount the row as a system bug.
    const allOwnerless =
      ws.capabilitiesWithoutOwners.count >= m.totalCapabilities;
    portfolioRisks.push(
      allOwnerless
        ? [
            `Capability ownership is not recorded on any of the ${m.totalCapabilities} capabilities — data-collection gap, not a portfolio finding`,
            "H",
            "H",
            "Capture business + IT owner pairs in the platform before the next portfolio review; ownership is the first gate the Wave-1 commit walks through.",
          ]
        : [
            `${ws.capabilitiesWithoutOwners.count} capabilities lack a business + IT owner pair — accountability gap blocks Wave-1 commit`,
            "M",
            "H",
            "Assign a business owner and IT owner to every CRITICAL/HIGH capability before the next portfolio review.",
          ]
    );
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

export function buildExecSummaryFacts(
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

export function buildKeyFindingsFacts(
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

export function buildBandNarrativesFacts(
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

export function buildDeepDivesFacts(
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

export function collectAllowedCounts(m: CapabilityMaturityMetrics): number[] {
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

export async function generateExecSummary(
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
        max_tokens: 2400,
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
    `Findings indicate the ${facts.clientName} capability portfolio comprises ${facts.totalCapabilities} capabilities at ${coveragePct}% assessment coverage. ${facts.bandSizes.lift} require uplift on the priority lift band, carrying ${facts.cumulativeGapLevels} cumulative maturity-level gaps; ${facts.bandSizes.investBeyond} CRITICAL/HIGH capabilit${facts.bandSizes.investBeyond === 1 ? "y sits" : "ies sit"} at MANAGED maturity and warrant${facts.bandSizes.investBeyond === 1 ? "s" : ""} beyond-target investment to lead-the-industry positioning.`
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

export async function generateKeyFindings(
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
        max_tokens: 3000,
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
      // Pad to 5 from deterministic fallback when LLM emits fewer.
      // The section header promises "Five Key Findings"; shipping 4
      // breaks the partner-skim contract.
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
  // Build a generous pool of candidate findings, then pick the
  // first 5 that fire. Each candidate has an `if`-guard; this
  // function MUST always return exactly 5, so the pool needs
  // enough always-true (or near-always-true) candidates after
  // the data-conditional ones to fill the slate.
  const coveragePct = Math.round(facts.assessmentCoverageRatio * 100);
  const ws = facts.workspaceSpecificRisks;
  const candidates: Array<{ when: boolean; finding: KeyFinding }> = [];

  // 1. Priority lift cohort — always fires when there are any lifts.
  if (facts.bandSizes.lift > 0) {
    const top3 = facts.topGaps3.slice(0, 3);
    const topL1Name = facts.topL1?.name ?? "the leading L1 domain";
    candidates.push({
      when: true,
      finding: {
        title: `${facts.bandSizes.lift} priority lift candidates anchor the FY capability investment plan`,
        body: `${facts.bandSizes.lift} capabilities at CRITICAL or HIGH strategic importance carry ${facts.cumulativeGapLevels} cumulative maturity-level gaps; ${Math.round(facts.appReadinessShare * 100)}% have applications mapped, signalling immediate execution-readiness for Wave-1 commitment.${top3.length > 0 ? ` Top of the cohort by composite priority weight: ${top3.join(", ")}.` : ""} The cohort concentrates on the ${topL1Name} domain and defines the engagement's primary investment thesis. Wave-1 sequencing follows application readiness, not gap magnitude alone — orphaned capabilities default to NEXT until tooling stands up in parallel.`,
      },
    });
  }

  // 2. Top L1 concentration.
  if (facts.topL1) {
    const sharePct = facts.cumulativeGapLevels > 0
      ? Math.round((facts.topL1.gapLevels / facts.cumulativeGapLevels) * 100)
      : 0;
    candidates.push({
      when: true,
      finding: {
        title: `${facts.topL1.name} domain owns the largest cumulative maturity gap`,
        body: `${facts.topL1.name} carries ${facts.topL1.gapLevels} cumulative gap-levels across ${facts.topL1.childCount} L2/L3 capabilities — ${sharePct}% of the priority-lift cumulative ${facts.cumulativeGapLevels}-level case and the largest single domain investment ask in the portfolio. Concentration of this magnitude warrants a dedicated programme stream rather than distributed investment across L1 domains; centre-of-excellence anchoring on the ${facts.topL1.name} cluster compounds the lift across child capabilities. Sequence Wave-1 governance + tooling commitments around this domain in the FY26 budget cycle.`,
      },
    });
  }

  // 3. Coverage gap (only when material).
  if (coveragePct < 80) {
    const topUnassessed = ws.topUnassessedL1?.l1Name;
    candidates.push({
      when: true,
      finding: {
        title: `${100 - coveragePct}% of capabilities remain NOT_ASSESSED — coverage gap blocks investment case framing`,
        body: `Assessment coverage stands at ${coveragePct}%; the unassessed tail blocks the investment case from being framed quantitatively across the full ${facts.totalCapabilities}-capability portfolio. ${topUnassessed ? `The gap concentrates in the ${topUnassessed} domain — one assessment workshop on this cluster closes the largest single coverage gap. ` : ""}Capability owners must complete maturity ratings before the unassessed tail can be sequenced; coverage gap closure is a precondition to budget commit. Sequence assessment workshops in the Wave-1 prep period as a parallel work-stream to the priority lift programme.`,
      },
    });
  }

  // 4. CRITICAL-at-INITIAL/DEVELOPING asymmetry — workspace-specific risk
  //    surfaced as a finding. Always available; fires when count > 0.
  if (ws.criticalAtInitialOrDeveloping.count > 0) {
    const n = ws.criticalAtInitialOrDeveloping.count;
    const top3 = ws.criticalAtInitialOrDeveloping.capabilities.slice(0, 3);
    const topL1 = facts.topL1?.name ?? "the leading L1 domain";
    candidates.push({
      when: true,
      finding: {
        title: `${n} CRITICAL capabilit${n === 1 ? "y sits" : "ies sit"} at INITIAL or DEVELOPING maturity`,
        body: `The portfolio carries ${n} CRITICAL-importance capabilit${n === 1 ? "y" : "ies"} at the lowest two maturity levels${top3.length > 0 ? ` — including ${top3.join(", ")}${ws.criticalAtInitialOrDeveloping.capabilities.length > 3 ? `, plus ${ws.criticalAtInitialOrDeveloping.capabilities.length - 3} more` : ""}` : ""}. The asymmetry between strategic importance and current state is the largest single quality signal in the deck and concentrates on the ${topL1} domain. The cohort's lift case combines a forced timeline (CRITICAL importance) with a deep gap (INITIAL/DEVELOPING current state); Wave-1 sequencing prioritizes this cohort and gates FY budget on owner accountability + assessment-workshop completion.`,
      },
    });
  }

  // 5. Application-readiness asymmetry. Always meaningful when lift > 0.
  if (facts.bandSizes.lift > 0) {
    const readyPct = Math.round(facts.appReadinessShare * 100);
    const orphaned = Math.max(
      0,
      facts.bandSizes.lift -
        Math.round(facts.appReadinessShare * facts.bandSizes.lift)
    );
    candidates.push({
      when: true,
      finding: {
        title: `${readyPct}% of priority lift capabilities have applications mapped — execution readiness is the gating signal`,
        body: `${readyPct}% of the ${facts.bandSizes.lift} priority lift capabilities map to at least one application; the orphaned ${orphaned} require dedicated tooling stand-up before the capability lift can commit. Capability lift on the orphaned cohort carries different programme economics than uplifting an existing application — tooling decisions move on the rationalization-track gate rather than the maturity-track gate. Wave-1 sequencing follows application readiness, not gap magnitude alone; the cross-deliverable bridge to the Application Rationalization Plan resolves the dual-gate dependency for these capabilities.`,
      },
    });
  }

  // 6. Invest-beyond cohort — pluralized.
  if (facts.bandSizes.investBeyond > 0) {
    const ib = facts.bandSizes.investBeyond;
    const noun = ib === 1 ? "capability" : "capabilities";
    const verb = ib === 1 ? "is" : "are";
    candidates.push({
      when: true,
      finding: {
        title: `${ib} ${noun} position${ib === 1 ? "s" : ""} for industry-leading investment`,
        body: `${ib} CRITICAL or HIGH-importance ${noun} sit${ib === 1 ? "s" : ""} at MANAGED maturity and ${verb} positioned to push to OPTIMIZING in the FY+1 budget cycle. The forward-investment case anchors the trajectory after the Wave-1 lift cohort lands and converts established tooling foundations into industry-leading positioning rather than addressing capability gaps. Investment beyond target requires executive commitment to advanced analytics, real-time operations, and capability-stretch initiatives that compose onto the existing application stack rather than triggering re-platforming. Sequence the OPTIMIZING roadmap design in the FY+1 prep period, post-Wave-1 stabilization.`,
      },
    });
  }

  // 7. Reassess cohort.
  if (facts.bandSizes.reassess > 0) {
    candidates.push({
      when: true,
      finding: {
        title: `${facts.bandSizes.reassess} capabilities warrant investment rebalancing`,
        body: `${facts.bandSizes.reassess} capabilities are over-served relative to strategic importance — current maturity exceeds target or LOW-importance capabilities sit at OPTIMIZING. Redirect capacity from these areas to the priority lift programme rather than retiring the capability; acknowledge prior investment as past-tense fact while reallocating going forward. The rebalancing case anchors the engagement's reallocation track and frees capacity for the cumulative ${facts.cumulativeGapLevels}-level lift case across CRITICAL/HIGH capabilities. Reassess strategic importance every six months to confirm the band membership before commitment.`,
      },
    });
  }

  // 8. Top unassessed L1 — when present.
  if (
    ws.topUnassessedL1 &&
    ws.topUnassessedL1.share > 0
  ) {
    const sharePct = Math.round(ws.topUnassessedL1.share * 100);
    candidates.push({
      when: true,
      finding: {
        title: `${ws.topUnassessedL1.l1Name} carries ${sharePct}% of the assessment gap`,
        body: `${sharePct}% of the unassessed capabilities sit in the ${ws.topUnassessedL1.l1Name} domain — the highest single concentration of NOT_ASSESSED capabilities in the portfolio. One assessment workshop on this cluster closes the largest single coverage gap and unlocks the investment case for those capabilities quantitatively. Sequence the workshop before the next portfolio review with capability owners and engagement-team facilitation; the workshop output feeds the Wave-1 prep period and the cumulative-gap recalibration. Coverage closure on the ${ws.topUnassessedL1.l1Name} cluster is a precondition to the domain's lift case being framed against the rest of the portfolio.`,
      },
    });
  }

  // 9. Capabilities without owners — accountability finding.
  if (ws.capabilitiesWithoutOwners.count > 0) {
    const n = ws.capabilitiesWithoutOwners.count;
    const allOwnerless = n >= facts.totalCapabilities;
    candidates.push({
      when: true,
      finding: allOwnerless
        ? {
            title: `Capability ownership is not recorded for any of the ${facts.totalCapabilities} capabilities`,
            body: `Ownership is the first gate the Wave-1 commit walks through; the data-collection gap on business + IT owner pairs across all ${facts.totalCapabilities} capabilities is the most actionable item before the FY budget cycle. Capture owner pairs in the platform before the next portfolio review; ownership signals validate band membership and gate accountability for capability lift commitments. The accountability map also feeds the cross-deliverable bridge into the Application Rationalization Plan — owner agreement on disposition decisions concentrates on the same names, so the data-collection effort compounds across both deliverables.`,
          }
        : {
            title: `${n} capabilit${n === 1 ? "y lacks" : "ies lack"} a business + IT owner pair`,
            body: `Accountability gap on ${n} of ${facts.totalCapabilities} capabilities blocks Wave-1 commit; ownership is the first gate the budget cycle walks through. Assign business + IT owners to every CRITICAL or HIGH-importance capability before the next portfolio review and gate FY budget on owner accountability. The ownership map also feeds the engagement's risks watch-list and the cross-deliverable bridge to the Application Rationalization Plan, where the same owners co-validate TIME dispositions on linked applications.`,
          },
    });
  }

  // 10. Always-true scope finding — last resort to guarantee 5.
  candidates.push({
    when: true,
    finding: {
      title: `${facts.totalCapabilities} capabilities define the assessment scope across ${Object.keys(facts.byImportance).length} importance bands`,
      body: `The portfolio spans ${facts.totalCapabilities} capabilities across the L1/L2/L3 hierarchy at ${coveragePct}% assessment coverage. Coverage and consistency across the hierarchy determine how much of the investment case can be framed quantitatively versus qualitatively in the body sections below; the cumulative ${facts.cumulativeGapLevels}-level lift case rests on the assessed subset and grows as the unassessed tail closes. The scope spans ${Object.keys(facts.byImportance).length} importance bands and ${Object.keys(facts.byCurrentMaturity).length} current-maturity states; the importance × maturity matrix in the next chapter visualizes the densest cells.`,
    },
  });

  // Pick first 5 unique findings.
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

export async function generateBandNarratives(
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
        max_tokens: 4500,
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
        .map((k) => `${narratives[k].governingThought} ${narratives[k].whyNow.join(" ")} ${narratives[k].whatItMeans} ${narratives[k].counterfactual} ${narratives[k].action}`)
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
    // Accept 3-5 whyNow bullets (LLM may emit fewer than the 5
    // we ask for; pad with em-dashes if so, cap at 5).
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
        whyNow: ["—", "—", "—", "—", "—"],
        whatItMeans: "—",
        counterfactual: "—",
        action: "—",
      };
    }
    const top5 = block.top5.slice(0, 5).map((c) => c.name);
    const top3 = top5.slice(0, 3);
    const avgGap = block.count > 0
      ? (block.cumulativeGap / block.count).toFixed(1)
      : "0";
    const sustainCounterfactual = kind === "SUSTAIN" ? "—" : null;
    return {
      governingThought: `${block.count} capabilit${block.count === 1 ? "y sits" : "ies sit"} in the ${kind} band, carrying ${block.cumulativeGap} cumulative gap-levels at an average of ${avgGap} levels per capability.`,
      whyNow: [
        top5[0] ? `${top5[0]} anchors the band by composite priority weight.` : "Top capability by priority weight not yet ranked.",
        top5[1] ? `${top5[1]} carries the second-largest weighted gap in the band.` : "—",
        top5[2] ? `${top5[2]} reinforces the cohort's investment thesis.` : "—",
        `Average gap across the band: ${avgGap} levels per capability across ${block.count} member${block.count === 1 ? "" : "s"}.`,
        `Engagement team validates the band membership before commitment; capability owners confirm gap magnitude.`,
      ],
      whatItMeans: `Investment in this band aligns with the action class and the cumulative ${block.cumulativeGap}-level lift case. Sequencing and ownership accountability gate execution. Application readiness varies across the cohort; the deep dives below extend the case for the top-priority members.`,
      counterfactual:
        sustainCounterfactual ??
        (top3.length > 0
          ? `Without Wave-1 priority on this band, ${top3.join(", ")} progression stalls; the cumulative ${block.cumulativeGap}-level lift case slips into the FY+1 budget cycle and the cross-deliverable bridge to the rationalization plan loses execution alignment.`
          : `Without Wave-1 priority on this band, the cumulative ${block.cumulativeGap}-level lift case slips into the FY+1 budget cycle.`),
      action: `Sequence ${kind.toLowerCase()} actions per the wave heuristic by Q2; capability owners validate within 30 days; commit governance + tooling investment in the FY26 budget cycle.`,
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

export async function generateDeepDives(
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
        max_tokens: 4500,
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
      const topAppsById = new Map(topApps.map((c) => [c.id, c]));
      let valid = 0;
      for (const cap of facts.capabilities) {
        const entry = parsed[cap.id];
        if (
          entry &&
          typeof entry.dispositionRationale === "string" &&
          typeof entry.recommendedPath === "string" &&
          typeof entry.waveJustification === "string"
        ) {
          // riskProfile is new — accept LLM emission; when missing,
          // fall back to the deterministic version computed against
          // the full capability summary rather than failing the
          // whole batch.
          const fullCap = topAppsById.get(cap.id);
          const fallbackRisk = fullCap
            ? deterministicDeepDiveFallback(fullCap).riskProfile
            : "";
          byId[cap.id] = {
            dispositionRationale: entry.dispositionRationale,
            recommendedPath: entry.recommendedPath,
            riskProfile:
              typeof entry.riskProfile === "string" &&
              entry.riskProfile.trim().length > 0
                ? entry.riskProfile
                : fallbackRisk,
            waveJustification: entry.waveJustification,
          };
          valid++;
        }
      }
      if (valid < facts.capabilities.length) continue;
      const allText = Object.values(byId)
        .map(
          (d) =>
            `${d.dispositionRationale} ${d.recommendedPath} ${d.riskProfile} ${d.waveJustification}`
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
  const cur = cap.currentMaturity.replace(/_/g, " ");
  const tgt = cap.targetMaturity.replace(/_/g, " ");
  const imp = cap.strategicImportance.replace(/_/g, " ");
  const gapPhrase =
    cap.gapLevels === null
      ? "unknown gap"
      : cap.gapLevels > 0
        ? `${cap.gapLevels}-level lift`
        : cap.gapLevels < 0
          ? `${Math.abs(cap.gapLevels)}-level over-served`
          : "at-target";
  const apps = cap.appsMapped ?? [];
  const appsLine = apps.length === 0
    ? `No application is mapped to this capability — capability lift requires standing up dedicated tooling, which carries different programme economics than uplifting an existing app and qualifies as the orphaned-capability gating risk.`
    : `${apps.length} application${apps.length === 1 ? "" : "s"} map${apps.length === 1 ? "s" : ""} to this capability: ${apps.slice(0, 3).map((a) => `${a.name} [${a.rationalizationStatus ?? "UNCLASSIFIED"}, ${a.lifecycle.replace(/_/g, " ")}]`).join("; ")}${apps.length > 3 ? `, and ${apps.length - 3} more` : ""}.`;
  const dispositionRationale =
    `${cap.name} carries a ${gapPhrase} in the ${cap.l1Name} domain at ${imp} strategic importance, currently at ${cur} maturity and targeting ${tgt}. ` +
    `The gap magnitude positions this capability among the band's higher-priority members and anchors its share of the cumulative lift case. ` +
    `${appsLine} ` +
    (apps.some((a) => a.rationalizationStatus === "ELIMINATE")
      ? `The ELIMINATE disposition on a linked application signals a capability migration in flight; the lift cannot lag the retirement.`
      : apps.some((a) => a.rationalizationStatus === "MIGRATE" || a.rationalizationStatus === "INVEST")
        ? `Linked-app dispositions of MIGRATE/INVEST reinforce execution-readiness for capability lift through the existing tooling foundation.`
        : `Application-readiness signal is mixed; engagement team confirms platform capacity before commit.`);

  let recPath: string;
  if (cap.appsMappedCount === 0) {
    recPath = `Stand up dedicated tooling for the ${cap.l1Name} capability area or a managed-platform replacement that absorbs the capability scope. Pair the platform stand-up with capability ownership assignment, governance framework establishment, and a measurement layer; the orphaned-capability path requires the parallel rationalization-track new-tool decision before the lift can sequence.`;
  } else if (cap.currentMaturity === "INITIAL" || cap.currentMaturity === "DEVELOPING") {
    recPath = `Governance framework plus measurement layer plus center-of-excellence anchoring for the ${cap.l1Name} domain; execute through the existing application stack and uplift maturity through process discipline rather than re-platforming. ${apps[0] ? `${apps[0].name} provides the execution foundation; capability lift composes onto its current capability scope.` : ""}`;
  } else {
    recPath = `Platform modernization paired with governance uplift; sequence around application-stack capacity and capability-owner availability. The lift draws on existing tooling foundations rather than net-new stand-up.`;
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

  // Risk profile — pick dominant class, develop in 2-3 sentences.
  let riskProfile: string;
  if (cap.appsMappedCount === 0) {
    riskProfile = `Orphaned-tooling risk dominates: capability lift depends on a parallel rationalization-track stand-up, and timing slip on either side cascades into the FY+1 budget cycle. Mitigation: bundle the orphaned ${cap.name} lift with the rationalization-track new-tool decision so commitments move on the same gate.`;
  } else if (apps.some((a) => a.rationalizationStatus === "ELIMINATE" || a.lifecycle === "PHASING_OUT")) {
    const elim = apps.find((a) => a.rationalizationStatus === "ELIMINATE" || a.lifecycle === "PHASING_OUT");
    riskProfile = `Linked-app ELIMINATE risk: ${elim?.name ?? "the linked application"} sits in PHASING_OUT lifecycle and the capability's tooling foundation has a known sunset; the lift cannot lag the retirement. Mitigation: gate the ${cap.name} replacement timeline against the application's decommission calendar; sequence both as a single Wave-1 cohort.`;
  } else if (cap.currentMaturity === "INITIAL" || cap.currentMaturity === "DEVELOPING") {
    riskProfile = `Skills-gap risk: the lift from ${cur} to ${tgt} in the ${cap.l1Name} domain requires specialty knowledge depth the FY plan must accommodate via hires plus ramp time. Mitigation: stand up a center-of-excellence with a named lead before Wave-1 kickoff; capability owners validate skill availability at Week 4.`;
  } else {
    riskProfile = `Dependency-chain risk: ${cap.name}'s lift composes onto adjacent capabilities in the ${cap.l1Name} domain; sequencing this capability without confirming dependency progression is a sequencing trap. Mitigation: dependency-aware sequencing using the CapabilityDependency graph; load-test the dependency map before commit.`;
  }

  return {
    dispositionRationale,
    recommendedPath: recPath,
    riskProfile,
    waveJustification: `Wave ${wave}: driven by ${imp} importance and ${cur} starting maturity${cap.appsMappedCount === 0 ? " with no mapped application" : ""}.`,
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
