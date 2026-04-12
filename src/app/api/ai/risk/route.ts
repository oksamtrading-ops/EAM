import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { rateLimit } from "@/lib/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-opus-4-6";

/** Strip markdown code-block fences (```json ... ```) from AI responses */
function stripCodeBlock(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return match ? match[1]!.trim() : trimmed;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = rateLimit(userId, { maxRequests: 5, windowMs: 60_000 });
  if (!allowed) {
    return Response.json(
      { error: "Rate limit exceeded. Please wait a moment before trying again." },
      { status: 429 }
    );
  }

  const { action, workspaceId, payload } = await req.json();

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId },
    include: { user: true },
  });
  if (!workspace || workspace.user.clerkId !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  switch (action) {
    case "radar-classify":
      return radarClassify(workspace, payload);
    case "risk-narrative":
      return riskNarrative(workspace, payload);
    case "compliance-gap":
      return complianceGap(workspace, payload);
    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
  }
}

// Prompt J — Tech Radar Classification Suggestions
async function radarClassify(
  workspace: any,
  payload: {
    components: Array<{
      name: string;
      vendor?: string;
      version?: string;
      lifecycle: string;
      technicalHealth: string;
      appCount: number;
    }>;
  }
) {
  const componentList = payload.components
    .map(
      (c) =>
        `- ${c.name}${c.vendor ? ` (${c.vendor})` : ""}${c.version ? ` v${c.version}` : ""} | Lifecycle: ${c.lifecycle} | Health: ${c.technicalHealth} | Used by ${c.appCount} app(s)`
    )
    .join("\n");

  const prompt = `You are an enterprise architecture consultant classifying technologies on a Tech Radar for a client.

CLIENT: ${workspace.clientName || workspace.name}
INDUSTRY: ${workspace.industry}

UNCLASSIFIED TECHNOLOGIES:
${componentList}

Tech Radar Rings:
- ADOPT: Approved standard. Use for all new work.
- TRIAL: Worth evaluating with guardrails. Limited use.
- ASSESS: Interesting but not proven. POC only.
- HOLD: Not recommended. Plan migration/decommission.

Tech Radar Quadrants:
- LANGUAGES_FRAMEWORKS: Programming languages, frameworks, libraries
- PLATFORMS_INFRASTRUCTURE: Cloud, servers, OS, middleware, databases
- TOOLS_TECHNIQUES: DevOps, monitoring, development tools, methodologies
- DATA_STORAGE: Databases, data warehouses, caches, message queues

Rules:
- Technologies with RETIRED/SUNSET lifecycle or TH_CRITICAL health → HOLD
- Technologies with PHASING_OUT lifecycle or POOR health → ASSESS or HOLD based on replacement readiness
- Technologies with ACTIVE lifecycle and EXCELLENT/GOOD health → ADOPT or TRIAL
- Consider vendor lock-in, community support, and industry standards

OUTPUT FORMAT (JSON only, no markdown):
{
  "classifications": [
    {
      "name": "string",
      "ring": "ADOPT" | "TRIAL" | "ASSESS" | "HOLD",
      "quadrant": "LANGUAGES_FRAMEWORKS" | "PLATFORMS_INFRASTRUCTURE" | "TOOLS_TECHNIQUES" | "DATA_STORAGE",
      "rationale": "string (1-2 sentences)"
    }
  ]
}`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const text = (message.content[0] as any).text;
    const parsed = JSON.parse(stripCodeBlock(text));
    return Response.json(parsed);
  } catch {
    return Response.json(
      { classifications: [], error: "Failed to parse AI response" },
      { status: 200 }
    );
  }
}

// Prompt K — Risk Narrative for Executive Briefing
async function riskNarrative(
  workspace: any,
  payload: {
    stats: {
      total: number;
      open: number;
      critical: number;
      unmitigated: number;
    };
    topRisks: Array<{ title: string; category: string; score: number }>;
    eolSummary: { expired: number; urgent: number };
    complianceScore: number;
  }
) {
  const topRisksList = payload.topRisks
    .slice(0, 5)
    .map((r) => `- ${r.title} (${r.category}, score: ${r.score}/16)`)
    .join("\n");

  const prompt = `You are a senior technology risk advisor preparing an executive briefing for a board presentation.

CLIENT: ${workspace.clientName || workspace.name}
INDUSTRY: ${workspace.industry}

TECHNOLOGY RISK POSTURE SUMMARY:
- Total Risks Tracked: ${payload.stats.total}
- Open Risks: ${payload.stats.open}
- Critical Risks (score ≥ 12): ${payload.stats.critical}
- Unmitigated Risks: ${payload.stats.unmitigated}
- EOL Expired Items: ${payload.eolSummary.expired}
- EOL Urgent Items (< 90 days): ${payload.eolSummary.urgent}
- Overall Compliance Score: ${payload.complianceScore}%

TOP RISKS:
${topRisksList || "None recorded"}

TASK:
Write a 300–400 word executive technology risk briefing with exactly 4 paragraphs:
1. Current Risk Posture — overall assessment of risk exposure
2. Priority Areas — the 2-3 most pressing risk themes requiring leadership attention
3. Risk Trajectory — whether the risk profile is improving, stable, or worsening and why
4. Recommended Actions — 3 concrete actions leadership should take in the next 90 days

TONE: Board-level. Authoritative. Factual. No jargon. Suitable for a C-suite risk committee.
FORMAT: Plain prose, no bullet points, no headers, no markdown.`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  return Response.json({ narrative: (message.content[0] as any).text });
}

// Prompt L — Compliance Gap Analysis
async function complianceGap(
  workspace: any,
  payload: {
    framework: string;
    score: number;
    compliant: number;
    partial: number;
    nonCompliant: number;
    notAssessed: number;
    total: number;
    gaps: Array<{ controlId: string; title: string; status: string; category?: string }>;
  }
) {
  const gapList = payload.gaps
    .filter((g) => g.status !== "COMPLIANT" && g.status !== "EXEMPT")
    .map((g) => `- [${g.controlId}] ${g.title} — Status: ${g.status}${g.category ? ` (${g.category})` : ""}`)
    .join("\n");

  const prompt = `You are a compliance advisory expert conducting a gap analysis for a client seeking ${payload.framework} compliance.

CLIENT: ${workspace.clientName || workspace.name}
INDUSTRY: ${workspace.industry}
FRAMEWORK: ${payload.framework}

CURRENT COMPLIANCE SCORECARD:
- Overall Score: ${payload.score}%
- Compliant Controls: ${payload.compliant}/${payload.total}
- Partial Controls: ${payload.partial}/${payload.total}
- Non-Compliant Controls: ${payload.nonCompliant}/${payload.total}
- Not Assessed Controls: ${payload.notAssessed}/${payload.total}

GAPS AND PARTIAL CONTROLS:
${gapList || "None identified"}

TASK:
Produce a compliance gap analysis in JSON format.

OUTPUT FORMAT (JSON only, no markdown):
{
  "overallAssessment": "string (2-3 sentences on readiness)",
  "criticalGaps": [
    {
      "controlId": "string",
      "title": "string",
      "businessRisk": "string (1 sentence)",
      "remediation": "string (1-2 sentences)",
      "effort": "LOW" | "MEDIUM" | "HIGH"
    }
  ],
  "quickWins": [
    {
      "controlId": "string",
      "title": "string",
      "action": "string (1 sentence)"
    }
  ],
  "estimatedTimeToCompliance": "string (e.g. 6–9 months)"
}`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const text = (message.content[0] as any).text;
    const parsed = JSON.parse(stripCodeBlock(text));
    return Response.json(parsed);
  } catch {
    return Response.json(
      { overallAssessment: "Analysis unavailable.", criticalGaps: [], quickWins: [], estimatedTimeToCompliance: "Unknown" },
      { status: 200 }
    );
  }
}
