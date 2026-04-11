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
  capabilities: Array<{
    name: string;
    currentMaturity: string;
    targetMaturity: string;
    strategicImportance: string;
  }>;
  retireCandidates: Array<{
    name: string;
    annualCostUsd?: number;
    technicalHealth: string;
  }>;
  redundancies: Array<{ capabilityName: string; appCount: number }>;
  capabilityGaps: Array<{ capabilityName: string }>;
}) {
  const prompt = `You are an enterprise architecture consultant generating a transformation roadmap.

CLIENT: ${payload.clientName}
INDUSTRY: ${payload.industry}
PLANNING HORIZON: ${payload.planningHorizon}

CAPABILITY GAPS (no application support):
${payload.capabilityGaps.map((g) => `- ${g.capabilityName}`).join("\n") || "None identified"}

CAPABILITY MATURITY IMPROVEMENTS NEEDED:
${
  payload.capabilities
    .filter(
      (c) =>
        c.currentMaturity !== c.targetMaturity &&
        c.strategicImportance !== "NOT_ASSESSED"
    )
    .map(
      (c) =>
        `- ${c.name}: ${c.currentMaturity} → ${c.targetMaturity} (${c.strategicImportance})`
    )
    .join("\n") || "None identified"
}

RETIRE CANDIDATES:
${
  payload.retireCandidates
    .map(
      (a) =>
        `- ${a.name}: Health=${a.technicalHealth}${a.annualCostUsd ? `, Cost=$${a.annualCostUsd}/yr` : ""}`
    )
    .join("\n") || "None identified"
}

REDUNDANCIES:
${
  payload.redundancies
    .map((r) => `- ${r.capabilityName}: ${r.appCount} overlapping applications`)
    .join("\n") || "None identified"
}

TASK:
Propose 4–8 transformation initiatives addressing the above findings.
Group them into H1 (0–6 months), H2 (6–18 months), H3 (18–36 months) horizons.
Each initiative should be concrete, actionable, and business-outcome oriented.

OUTPUT FORMAT (JSON only, no markdown):
{
  "initiatives": [
    {
      "name": "string",
      "description": "string",
      "category": "MODERNISATION" | "CONSOLIDATION" | "DIGITALISATION" | "COMPLIANCE" | "OPTIMISATION" | "INNOVATION" | "DECOMMISSION",
      "horizon": "H1_NOW" | "H2_NEXT" | "H3_LATER",
      "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "estimatedBenefits": "string (1 sentence)",
      "addressesCapabilities": ["string"],
      "addressesApplications": ["string"],
      "suggestedMilestones": ["string"],
      "dependencies": ["string (initiative name)"]
    }
  ],
  "narrativeSummary": "string (3-4 sentences executive summary)"
}`;

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (message.content[0] as any).text as string;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    return Response.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error("[AI/roadmap/suggest]", err);
    return Response.json({ error: "AI generation failed" }, { status: 500 });
  }
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
