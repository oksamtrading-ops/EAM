import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { rateLimit } from "@/lib/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = rateLimit(userId, { maxRequests: 10, windowMs: 60_000 });
  if (!allowed) {
    return Response.json(
      { error: "Rate limit exceeded. Please wait before trying again." },
      { status: 429 }
    );
  }

  const { action, payload } = await req.json();

  switch (action) {
    case "suggest-initiatives":
      return suggestInitiatives(payload);
    case "state-narrative":
      return generateStateComparisonNarrative(payload);
    case "risk-assessment":
      return assessInitiativeRisks(payload);
    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
  }
}

// ── Prompt G — Roadmap Generation from Portfolio Snapshot ────

async function suggestInitiatives(payload: {
  clientName: string;
  industry: string;
  planningHorizon: string;
  assessedCapCount: number;
  totalCapCount: number;
  appCount: number;
  capabilities: Array<{
    name: string;
    level: string;
    currentMaturity: string;
    targetMaturity: string;
    strategicImportance: string;
  }>;
  retireCandidates: Array<{
    name: string;
    annualCostUsd?: number;
    technicalHealth: string;
    lifecycle: string;
  }>;
  redundancies: Array<{ capabilityName: string; appCount: number; apps: string[] }>;
  capabilityGaps: Array<{ capabilityName: string; level: string; strategicImportance: string }>;
}) {
  const maturityImprovements = payload.capabilities
    .filter(
      (c) =>
        c.currentMaturity !== c.targetMaturity &&
        c.currentMaturity !== "NOT_ASSESSED" &&
        c.targetMaturity !== "NOT_ASSESSED" &&
        c.strategicImportance !== "NOT_ASSESSED"
    )
    .map(
      (c) =>
        `- ${c.name} (${c.level}): ${c.currentMaturity} → ${c.targetMaturity} | Importance: ${c.strategicImportance}`
    )
    .join("\n") || "None identified";

  const retireCandidatesList = payload.retireCandidates
    .map(
      (a) =>
        `- ${a.name}: Health=${a.technicalHealth}, Lifecycle=${a.lifecycle}${a.annualCostUsd ? `, Cost=$${a.annualCostUsd.toLocaleString()}/yr` : ""}`
    )
    .join("\n") || "None identified";

  const redundanciesList = payload.redundancies
    .map((r) => `- ${r.capabilityName}: ${r.appCount} overlapping apps (${r.apps.join(", ")})`)
    .join("\n") || "None identified";

  const capGapsList = payload.capabilityGaps
    .map((g) => `- ${g.capabilityName} (${g.level}) | Importance: ${g.strategicImportance}`)
    .join("\n") || "None identified";

  const prompt = `ROLE
You are a senior Enterprise Architect and Transformation Planner with deep expertise in capability-based planning, trained on industry-standard frameworks including:
- TOGAF Architecture Development Method (ADM) — Phase E (Opportunities & Solutions) and Phase F (Migration Planning)
- Business Architecture Guild (BIZBOK) capability-based investment planning
- APQC Process Classification Framework (PCF) — cross-industry and industry-specific
- BIAN (Banking), eTOM (Telecom), ACORD (Insurance), SCOR (Supply Chain), ITIL/COBIT (IT), HL7/HIMSS (Healthcare), or the relevant industry equivalent
- CMM/CMMI maturity progression models
- Gartner TIME Model for application rationalization

Before generating initiatives, perform deep research by cross-referencing the input data against the applicable reference framework(s) for this industry. Validate that proposed initiatives are grounded in established EA transformation patterns, not invented generically.

OBJECTIVE
Propose a comprehensive, sequenced transformation roadmap of 4–10 initiatives that address ALL identified findings — capability maturity gaps, application retire candidates, redundancies, and unsupported capabilities. Every finding must be addressed by at least one initiative. Group initiatives into planning horizons and sequence them by dependency, strategic urgency, and feasibility.

INPUTS
- Client: ${payload.clientName}
- Industry: ${payload.industry}
- Planning Horizon: ${payload.planningHorizon}
- Assessment Coverage: ${payload.assessedCapCount} of ${payload.totalCapCount} capabilities assessed, ${payload.appCount} applications catalogued

Capability Gaps (no application support):
${capGapsList}

Capability Maturity Improvements Needed:
${maturityImprovements}

Application Retire Candidates:
${retireCandidatesList}

Application Redundancies (multiple apps supporting same capability):
${redundanciesList}

METHOD (follow in order)
1. Identify the reference framework(s) most applicable to this industry. Name them explicitly.
2. Cluster related findings into logical transformation themes (e.g., "Digital Operations Modernization", "Legacy Decommission & Consolidation", "Data & Analytics Foundation").
3. For each theme, define one or more initiatives with clear business outcomes.
4. Sequence initiatives across horizons:
   - H1_NOW (0–6 months): Quick wins, critical risk mitigation, foundation capabilities
   - H2_NEXT (6–18 months): Core transformation, major capability uplift
   - H3_LATER (18–36 months): Optimization, innovation, advanced maturity targets
5. Identify dependencies between initiatives (e.g., data governance must precede analytics modernization).
6. For each initiative, propose 2–4 concrete milestones.
7. Assess confidence in each initiative based on data quality and completeness of inputs.

CONSTRAINTS
- Every capability gap, maturity delta, retire candidate, and redundancy must be addressed by at least one initiative.
- Do NOT invent findings. Work strictly from the input data provided.
- Do NOT cite frameworks you are not confident exist.
- Initiative names must be concise and business-outcome oriented (e.g., "Legacy CRM Decommission & Migration" not "Fix CRM").
- Dependencies must reference specific initiative names from your output, not generic concepts.
- Milestones must be concrete and measurable (e.g., "Complete data migration UAT" not "Make progress").
- If input data is sparse (many NOT_ASSESSED, few apps), flag this and adjust confidence accordingly.

OUTPUT FORMAT (JSON only, no markdown, no explanation):
{
  "referenceFrameworks": ["string — name of each framework used"],
  "initiatives": [
    {
      "name": "string",
      "description": "string (2-3 sentences: what this initiative delivers and why it matters)",
      "category": "MODERNISATION | CONSOLIDATION | DIGITALISATION | COMPLIANCE | OPTIMISATION | INNOVATION | DECOMMISSION",
      "horizon": "H1_NOW | H2_NEXT | H3_LATER",
      "priority": "CRITICAL | HIGH | MEDIUM | LOW",
      "confidence": "HIGH | MEDIUM | LOW",
      "estimatedBenefits": "string (1-2 sentences: expected business outcome)",
      "addressesCapabilities": ["string — capability names from input"],
      "addressesApplications": ["string — application names from input"],
      "suggestedMilestones": ["string — 2-4 concrete milestones"],
      "dependencies": ["string — other initiative names that must precede or run in parallel"],
      "riskIfDeferred": "string (1 sentence: what happens if this is not executed)"
    }
  ],
  "narrativeSummary": "string (4-6 sentences: executive summary of the transformation roadmap, key themes, sequencing rationale, and expected overall outcome)",
  "dataQualityNotes": ["string — any data gaps or assumptions that affect confidence"],
  "findingsCoverage": {
    "capabilityGapsAddressed": 0,
    "maturityDeltasAddressed": 0,
    "retireCandidatesAddressed": 0,
    "redundanciesAddressed": 0,
    "unaddressedFindings": ["string — any findings not covered, with reason"]
  }
}`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (message.content[0] as any).text as string;
    const parsed = JSON.parse(stripCodeBlock(text));
    return Response.json(parsed);
  } catch (err) {
    console.error("[AI/roadmap/suggest]", err);
    return Response.json({ error: "AI generation failed" }, { status: 500 });
  }
}

/** Strip markdown code-block fences (```json ... ```) from AI responses */
function stripCodeBlock(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return match ? match[1]!.trim() : trimmed;
}

// ── Prompt H — As-Is → To-Be Gap Narrative ───────────────────

async function generateStateComparisonNarrative(payload: {
  clientName: string;
  asIsLabel: string;
  toBeLabel: string;
  diff: {
    capDiffs: Array<{
      name: string;
      maturityChange: { from: string; to: string } | null;
    }>;
    appDiffs: {
      retired: string[];
      introduced: string[];
      modified: any[];
    };
    gapsClosed: Array<{ capabilityName: string }>;
    redundanciesResolved: Array<{ capabilityName: string }>;
  };
}) {
  const prompt = `You are an enterprise architect preparing a transformation narrative comparing current and target architecture states.

CLIENT: ${payload.clientName}
CURRENT STATE: ${payload.asIsLabel}
TARGET STATE: ${payload.toBeLabel}

CAPABILITY MATURITY IMPROVEMENTS:
${
  payload.diff.capDiffs
    .filter((d) => d.maturityChange)
    .map((d) => `- ${d.name}: ${d.maturityChange!.from} → ${d.maturityChange!.to}`)
    .join("\n") || "None"
}

APPLICATION CHANGES:
- Applications to be retired: ${payload.diff.appDiffs.retired.join(", ") || "None"}
- Applications to be introduced: ${payload.diff.appDiffs.introduced.join(", ") || "None"}
- Applications transitioning: ${
    payload.diff.appDiffs.modified
      .map((m: any) => `${m.name} (${m.from} → ${m.to})`)
      .join(", ") || "None"
  }

GAPS ADDRESSED: ${payload.diff.gapsClosed.map((g) => g.capabilityName).join(", ") || "None"}
REDUNDANCIES RESOLVED: ${payload.diff.redundanciesResolved.map((r) => (r as any).capabilityName ?? "").join(", ") || "None"}

TASK:
Write a concise transformation narrative (300–400 words) for a board-level audience covering:
1. The transformation ambition — what the organisation is moving toward
2. The most significant capability improvements and why they matter
3. The portfolio rationalisation story (applications retired, introduced, simplified)
4. The expected business outcomes in the target state

TONE: Visionary but grounded, business-outcome oriented, no technical jargon.
FORMAT: Flowing prose with no bullet points or headers.`;

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    return Response.json({ narrative: (message.content[0] as any).text });
  } catch (err) {
    console.error("[AI/roadmap/narrative]", err);
    return Response.json({ error: "AI generation failed" }, { status: 500 });
  }
}

// ── Prompt I — Initiative Risk Assessment ────────────────────

async function assessInitiativeRisks(payload: {
  initiativeName: string;
  description: string;
  category: string;
  startDate?: string;
  endDate?: string;
  budgetUsd?: number;
  milestones: Array<{ name: string; dueDate?: string; isCritical: boolean }>;
  dependencies: Array<{ name: string; status: string }>;
  capabilitiesAffected: number;
  applicationsAffected: number;
}) {
  const prompt = `You are an enterprise architecture risk advisor assessing a transformation initiative.

INITIATIVE: ${payload.initiativeName}
DESCRIPTION: ${payload.description}
CATEGORY: ${payload.category}
TIMELINE: ${payload.startDate ?? "TBD"} → ${payload.endDate ?? "TBD"}
BUDGET: ${payload.budgetUsd ? `$${payload.budgetUsd.toLocaleString()}` : "Not defined"}
CAPABILITIES AFFECTED: ${payload.capabilitiesAffected}
APPLICATIONS AFFECTED: ${payload.applicationsAffected}

MILESTONES:
${
  payload.milestones
    .map(
      (m) =>
        `- ${m.name}${m.dueDate ? ` (due ${m.dueDate})` : ""}${m.isCritical ? " [CRITICAL PATH]" : ""}`
    )
    .join("\n") || "None defined"
}

DEPENDENCIES (initiatives this depends on):
${
  payload.dependencies
    .map((d) => `- ${d.name}: status=${d.status}`)
    .join("\n") || "None"
}

TASK:
Assess the key risks for this initiative.

OUTPUT FORMAT (JSON only, no markdown):
{
  "overallRiskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "ragRecommendation": "GREEN" | "AMBER" | "RED",
  "risks": [
    {
      "category": "SCHEDULE" | "BUDGET" | "DEPENDENCY" | "SCOPE" | "CHANGE_MANAGEMENT" | "TECHNICAL",
      "description": "string",
      "likelihood": "LOW" | "MEDIUM" | "HIGH",
      "impact": "LOW" | "MEDIUM" | "HIGH",
      "mitigation": "string (1 sentence)"
    }
  ],
  "criticalPathWarnings": ["string"],
  "summary": "string (2-3 sentences)"
}`;

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (message.content[0] as any).text as string;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    return Response.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error("[AI/roadmap/risk]", err);
    return Response.json({ error: "AI risk assessment failed" }, { status: 500 });
  }
}
