import "server-only";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  Table,
  TextRun,
} from "docx";
import {
  buildActionTitle,
  buildHeading,
  buildCallout,
  buildKpiRow,
  buildTable,
  buildStaticTOC,
  makeFooter,
  normalizeHex,
  renderCoverPage,
  renderInsideCoverDisclaimer,
  renderSectionDivider,
  clampForContrast,
} from "./_helpers";
import { T } from "./tokens";
import type { ArchitectureRoadmapMetrics } from "./architectureRoadmapMetrics";

export const ARCHITECTURE_ROADMAP_BASELINE_TEMPLATE_VERSION = "1.0";
export const ARCHITECTURE_ROADMAP_BASELINE_TEMPLATE_LABEL = `EAM Architecture Roadmap Baseline Report v${ARCHITECTURE_ROADMAP_BASELINE_TEMPLATE_VERSION}`;
export const ARCHITECTURE_ROADMAP_BASELINE_PROJECT_LABEL =
  "Architecture Roadmap Baseline Report";
const INITIATIVE_THRESHOLD = 8;

export type ArchitectureRoadmapBaselineInput = {
  clientName: string;
  brandHex: string | null;
  preparedBy?: string | null;
  engagementCode?: string | null;
  contactLine?: string | null;
  metrics: ArchitectureRoadmapMetrics;
};

export type ArchitectureRoadmapBaselineResult = {
  buffer: Buffer;
  templateVersion: string;
  llmSource: "deterministic";
};

/**
 * Architecture Roadmap Baseline Report — coverage-fork deliverable.
 *
 * Generated when the workspace has fewer than 8 active initiatives.
 * Refuses to fake a multi-year transformation roadmap on sparse
 * data; instead names the highest-leverage initiatives to define
 * first, surfaces the cross-deliverable bridge gaps, and gives a
 * 30-day plan to unlock the full Architecture Roadmap.
 *
 * Mirrors buildPortfolioSnapshotReport.ts +
 * buildCapabilityMaturityBaselineReport.ts in shape and
 * discipline. Pure deterministic — no LLM calls.
 */
export async function buildArchitectureRoadmapBaselineReport(
  input: ArchitectureRoadmapBaselineInput
): Promise<ArchitectureRoadmapBaselineResult> {
  const brandHex = normalizeHex(input.brandHex);
  const m = input.metrics;
  const today = new Date().toISOString().slice(0, 10);
  const clamp = (h: string) => clampForContrast({ hex: h, bg: "#FFFFFF" });

  const fullBridgePct = Math.round(m.crossDeliverableCoverage.fullBridgeShare * 100);
  const orphanedCount = m.workspaceSpecificRisks.orphanedInitiatives.count;
  const ownerlessCount = m.workspaceSpecificRisks.wave1WithoutOwner.count;

  const children: (Paragraph | Table)[] = [];

  // Cover
  children.push(
    ...renderCoverPage({
      documentTitle: "Architecture Roadmap Baseline Report",
      clientName: input.clientName,
      brandHex,
      templateVersionLabel: ARCHITECTURE_ROADMAP_BASELINE_TEMPLATE_LABEL,
      preparedBy: input.preparedBy ?? null,
      logoBytes: null,
      logoMimeType: null,
      engagementCode: input.engagementCode ?? null,
      contactLine: input.contactLine ?? null,
      confidentialityLabel: `Strictly Confidential — Prepared for ${input.clientName}`,
    })
  );

  children.push(
    ...renderInsideCoverDisclaimer({
      clientName: input.clientName,
      date: today,
      brandHex,
    })
  );

  children.push(
    ...buildStaticTOC({
      brandHex,
      entries: [
        { title: "1. Where the roadmap stands", pageNumber: 4, indent: 0 },
        { title: "Roadmap at a Glance", pageNumber: 4, indent: 1 },
        { title: "Coverage gate", pageNumber: 5, indent: 1 },
        { title: "2. Top initiatives to define first", pageNumber: 6, indent: 0 },
        { title: "3. Cross-deliverable bridge gaps", pageNumber: 7, indent: 0 },
        { title: "4. 30-day work plan", pageNumber: 8, indent: 0 },
        { title: "5. Methodology & glossary", pageNumber: 9, indent: 0 },
      ],
    })
  );

  // ═══ 1. Where the roadmap stands ═════════════════════════
  children.push(
    ...renderSectionDivider({
      number: "1",
      title: "Where the roadmap stands",
      subtitle:
        "The honest picture before any wave plan or transformation thesis: what's defined, what isn't, and what that means for the case ahead.",
      brandHex,
    })
  );

  children.push(
    buildHeading("Roadmap at a Glance", HeadingLevel.HEADING_1, brandHex, {
      spacingBefore: 0,
    })
  );
  children.push(
    buildActionTitle(
      `${m.totalInitiatives} initiative${m.totalInitiatives === 1 ? "" : "s"} on the roadmap; below the ${INITIATIVE_THRESHOLD}-initiative threshold required for a multi-year transformation thesis. This report ranks where to focus the next definition cycle.`,
      brandHex
    )
  );
  children.push(
    buildKpiRow({
      brandHex,
      tiles: [
        { value: String(m.totalInitiatives), label: "Total initiatives" },
        { value: String(m.waves.NOW.count), label: "Wave 1 (NOW)" },
        { value: String(m.dependencyNetwork.edgeCount), label: "Dependency edges" },
        { value: `${fullBridgePct}%`, label: "Cross-deliverable bridge" },
        { value: String(orphanedCount), label: "Orphaned (no anchor)" },
        { value: String(ownerlessCount), label: "Wave-1 without owner" },
      ],
    })
  );

  children.push(
    buildCallout({
      title: "Coverage gate",
      tone: "warn",
      brandHex,
      bullets: [
        `${m.totalInitiatives} initiative${m.totalInitiatives === 1 ? "" : "s"} defined; the full Architecture Roadmap unlocks at ${INITIATIVE_THRESHOLD}.`,
        `Until the threshold is cleared, this report deliberately stops short of asserting wave-sequencing decisions or initiative-level investment cases without enough data to support them.`,
        `The Top initiatives to define first table below ranks the next definition cycle to clear the threshold with the least effort.`,
      ],
    })
  );

  // ═══ 2. Top initiatives to define first ═══════════════════
  children.push(
    ...renderSectionDivider({
      number: "2",
      title: "Top initiatives to define first",
      subtitle:
        "Ranked by composite priority weight (priority × dependency degree × cross-deliverable impact). Defining these first gives the steepest information gain per workshop hour.",
      brandHex,
    })
  );

  if (m.allInitiatives.length > 0) {
    children.push(
      buildHeading("Existing initiatives ranked by priority weight", HeadingLevel.HEADING_1, brandHex)
    );
    children.push(
      buildTable({
        headers: ["Initiative", "Wave", "Priority", "RAG", "Apps", "Caps", "Reason"],
        rows: m.allInitiatives
          .slice()
          .sort((a, b) => b.priorityWeight - a.priorityWeight)
          .map((i) => [
            i.name,
            i.wave,
            i.priority,
            i.ragStatus,
            String(i.appsLinkedCount),
            String(i.capabilitiesLinkedCount),
            reasonFor(i),
          ]),
        brandHex,
      })
    );
  } else {
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({
            text:
              "No initiatives are defined in the workspace. Add at least 4-6 initiatives before generating the Baseline Report; ideally each anchored against a named application disposition or capability lift.",
            italics: true,
            color: "4B5563",
            size: T.body,
          }),
        ],
      })
    );
  }

  // ═══ 3. Cross-deliverable bridge gaps ════════════════════
  children.push(
    ...renderSectionDivider({
      number: "3",
      title: "Cross-deliverable bridge gaps",
      subtitle:
        "What's missing on the rationalization + maturity links — the structural attribute that distinguishes a roadmap from a wishlist.",
      brandHex,
    })
  );

  children.push(
    buildHeading("Bridge state", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    buildActionTitle(
      `${fullBridgePct}% of initiative${m.totalInitiatives === 1 ? "" : "s"} carry the full cross-deliverable bridge (linked apps + linked capabilities); ${orphanedCount} sit orphaned with no anchor on either side.`,
      brandHex
    )
  );
  children.push(
    buildTable({
      headers: ["Bridge metric", "Value", "Implication"],
      rows: [
        [
          "Initiatives with linked applications",
          `${Math.round(m.crossDeliverableCoverage.appLinkedShare * 100)}%`,
          "Lower share signals weak ties to the rationalization output; cross-references will read thin in the full deliverable.",
        ],
        [
          "Initiatives with linked capabilities",
          `${Math.round(m.crossDeliverableCoverage.capabilityLinkedShare * 100)}%`,
          "Lower share signals weak ties to the maturity output; the lift case for each initiative cannot be framed structurally.",
        ],
        [
          "Initiatives with full bridge",
          `${fullBridgePct}%`,
          "Full-bridge initiatives are the platform's primary signal of programme integrity; aim for ≥70% before generating the full roadmap.",
        ],
        [
          "Orphaned initiatives",
          String(orphanedCount),
          "Anchor each against a named application or capability before the next portfolio review.",
        ],
      ],
      brandHex,
    })
  );

  // ═══ 4. 30-day work plan ═══════════════════════════════════
  children.push(
    ...renderSectionDivider({
      number: "4",
      title: "30-day work plan",
      subtitle:
        "How to clear the initiative threshold and the cross-deliverable bridge to unlock the full Architecture Roadmap.",
      brandHex,
    })
  );

  const planSteps: Array<[string, string]> = [
    [
      "Week 1: confirm initiative inventory",
      `Confirm the ${m.totalInitiatives} existing initiative${m.totalInitiatives === 1 ? "" : "s"} reflect current strategic commitments; identify the gap to ${INITIATIVE_THRESHOLD} and which programme themes are missing.`,
    ],
    [
      "Week 2: define the next 3-5 initiatives",
      `Workshop with capability + application owners to define ${Math.max(0, INITIATIVE_THRESHOLD - m.totalInitiatives)} additional initiative${Math.max(0, INITIATIVE_THRESHOLD - m.totalInitiatives) === 1 ? "" : "s"}; anchor each against ≥1 application disposition (rationalization) and ≥1 capability lift (maturity).`,
    ],
    [
      "Week 3: cross-deliverable bridge",
      `Map every initiative to its linked applications + capabilities; aim for ${Math.max(70, fullBridgePct + 20)}% full-bridge coverage. Anchor the ${orphanedCount} orphaned initiative${orphanedCount === 1 ? "" : "s"} against named entities.`,
    ],
    [
      "Week 4: regenerate the deliverable",
      `When the initiative count clears ${INITIATIVE_THRESHOLD} and full-bridge coverage clears 70%, regenerate from the deliverables console; the full Architecture Roadmap runs with the four-call LLM orchestration and per-initiative deep dives.`,
    ],
  ];
  for (const [title, body] of planSteps) {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: title,
            bold: true,
            color: clamp(brandHex),
            size: T.body,
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 160, line: 320 },
        children: [new TextRun({ text: body, size: T.body })],
      })
    );
  }

  // ═══ 5. Methodology & glossary ═════════════════════════════
  children.push(
    ...renderSectionDivider({
      number: "5",
      title: "Methodology & glossary",
      subtitle:
        "Source fields, threshold rationale, scope boundaries, and a glossary of the terms the report uses.",
      brandHex,
    })
  );
  children.push(
    buildHeading("Methodology", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    new Paragraph({
      spacing: { after: 160, line: 320 },
      children: [
        new TextRun({
          text: `Generated on ${today} from the live initiative portfolio in the EAM platform. Counts and dependency edges reflect values stored on each Initiative record at generation; the source fields are *horizon*, *ragStatus*, *priority*, *category*, *InitiativeApplicationMap*, *InitiativeCapabilityMap*, and *InitiativeDependency*.`,
          size: T.body,
        }),
      ],
    })
  );
  children.push(
    buildCallout({
      title: "What this report is not",
      tone: "info",
      brandHex,
      bullets: [
        "Not a multi-year transformation thesis. Sparse initiative data cannot frame wave-level investment commitments without the dependency network density to support them.",
        "Not an investment-cost case. The deliverable's currency is initiative count × wave × dependency coverage; per-initiative budgets are not aggregated in v1.",
        "Not a substitute for the full Architecture Roadmap. When initiative count clears 8 and cross-deliverable bridge coverage clears 70%, regenerate from the deliverables console.",
      ],
    })
  );

  children.push(
    buildHeading("Glossary", HeadingLevel.HEADING_1, brandHex)
  );
  children.push(
    buildTable({
      headers: ["Term", "Definition"],
      rows: [
        [
          "Initiative threshold",
          `${INITIATIVE_THRESHOLD} active initiatives. Below threshold the full Architecture Roadmap is withheld; the Baseline Report ranks definition priorities instead.`,
        ],
        [
          "Cross-deliverable bridge",
          "Bridge to the Application Rationalization Plan (linked apps + TIME dispositions) AND the Capability Maturity Assessment (linked capabilities + maturity progression). Full bridge = both sides populated.",
        ],
        [
          "Wave",
          "NOW (<12mo) / NEXT (12-24mo) / LATER (24-36mo). Maps to Initiative.horizon.",
        ],
        [
          "Priority weight",
          "Composite ranking: priorityScore × (1 + dependencyDegree × 0.5) × log(1 + capabilityImpact + appImpact). Used to rank definition priorities here and deep-dive candidates in the full deliverable.",
        ],
        [
          "Orphaned initiative",
          "Neither linked application nor linked capability — strategic value not anchored to either prior deliverable.",
        ],
      ],
      brandHex,
    })
  );

  // Build doc
  const doc = new Document({
    creator: input.clientName,
    title: `${input.clientName} — Architecture Roadmap Baseline Report`,
    description: ARCHITECTURE_ROADMAP_BASELINE_TEMPLATE_LABEL,
    sections: [
      {
        properties: {},
        children: children as never,
        footers: {
          default: makeFooter(
            input.clientName,
            ARCHITECTURE_ROADMAP_BASELINE_PROJECT_LABEL
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
    templateVersion: ARCHITECTURE_ROADMAP_BASELINE_TEMPLATE_VERSION,
    llmSource: "deterministic",
  };
}

function reasonFor(i: {
  appsLinkedCount: number;
  capabilitiesLinkedCount: number;
  priority: string;
  ragStatus: string;
  blocking: Array<unknown>;
}): string {
  if (i.appsLinkedCount === 0 && i.capabilitiesLinkedCount === 0) {
    return "Orphaned — anchor against a named application or capability before commit.";
  }
  if (i.blocking.length >= 3) {
    return `Keystone (${i.blocking.length} downstream initiatives depend on it) — protect delivery.`;
  }
  if (i.ragStatus === "RED") {
    return "RED RAG — recovery plan before next steerco.";
  }
  if (i.priority === "CRITICAL") {
    return "CRITICAL priority — define wave + dependencies + ownership.";
  }
  return `${i.priority} priority — define dependency edges + cross-deliverable anchors.`;
}
