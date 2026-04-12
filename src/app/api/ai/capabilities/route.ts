import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { rateLimit } from "@/lib/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 10 AI requests per minute per user
  const { allowed } = rateLimit(userId, { maxRequests: 10, windowMs: 60_000 });
  if (!allowed) {
    return Response.json(
      { error: "Rate limit exceeded. Please wait a moment before trying again." },
      { status: 429 }
    );
  }

  const { action, workspaceId, payload } = await req.json();

  // Verify workspace ownership
  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId },
    include: { user: true },
  });
  if (!workspace || workspace.user.clerkId !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  switch (action) {
    case "suggest":
      return suggestCapabilities(workspace, payload);
    case "gap-analysis":
      return generateGapAnalysis(workspace, payload);
    case "investment-priorities":
      return generateInvestmentPriorities(workspace, payload);
    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
  }
}

async function suggestCapabilities(
  workspace: any,
  payload: {
    industry: string;
    existingCapabilities: string;
    organizationContext: string;
  }
) {
  const prompt = `ROLE
You are a senior Enterprise Architect with deep expertise in business capability modeling, trained on industry-standard reference frameworks including:
- APQC Process Classification Framework (PCF) — cross-industry and industry-specific
- BIAN (Banking), eTOM (Telecom), ACORD (Insurance), SCOR (Supply Chain), ITIL/COBIT (IT), HL7/HIMSS (Healthcare), or the relevant industry equivalent
- TOGAF and Business Architecture Guild (BIZBOK) capability modeling standards

OBJECTIVE
Identify business capabilities that are MISSING from the provided capability list, grounded in industry best practices for the specified industry. Produce a comprehensive, deduplicated gap list suitable for an EA capability heatmap review.

INPUTS
- Industry / sub-industry: ${payload.industry}
- Organization context: ${payload.organizationContext}
- Existing capabilities (verbatim list):
${payload.existingCapabilities}
- Target capability levels: L1 and L2
- Scope: All domains

METHOD (follow in order)
1. Identify the authoritative reference model(s) most applicable to the stated industry. Name them explicitly in your output.
2. Derive the expected capability set at L1 and L2 from those reference model(s), covering all major domains: Strategy & Governance, Customer, Product & Service, Operations & Delivery, Supply Chain / Partner, Finance, HR / People, Technology & Data, Risk / Compliance / Security, and industry-specific domains.
3. Normalize the provided existing capabilities (synonyms, re-wordings, parent/child relationships) before comparing — do NOT flag a capability as missing if it is present under a different but equivalent name.
4. Compare the reference set against the normalized existing set. Output only the genuine gaps.
5. For each gap, verify it is not a sub-capability of something already listed.

CONSTRAINTS
- Do NOT invent frameworks or cite sources you are not confident exist.
- Do NOT duplicate existing capabilities or list near-synonyms of them as gaps.
- Do NOT propose processes, applications, or technologies — capabilities only (what the business does, not how).
- Use noun-phrase naming ("Customer Onboarding Management", not "Onboard Customers").
- Maintain consistent grammatical level — do not mix Level 1 and Level 2 items in the same suggestion without clearly labeling each.
- Suggest 5-10 capabilities total, prioritized by strategic and operational impact.

OUTPUT FORMAT (JSON only, no markdown, no explanation):
{
  "referenceFrameworks": ["string — name of each framework used"],
  "suggestions": [
    {
      "name": "string",
      "level": "L1" | "L2",
      "suggestedParent": "string | null (existing L1 name if this is an L2, null if L1)",
      "domain": "string (which EA domain this falls under)",
      "rationale": "string (1-2 sentences explaining why this is missing and its strategic relevance)",
      "strategicImportance": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ]
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const text = (message.content[0] as any).text;
    const parsed = JSON.parse(stripCodeBlock(text));
    return Response.json(parsed);
  } catch {
    return Response.json(
      { suggestions: [], error: "Failed to parse AI response" },
      { status: 200 }
    );
  }
}

/** Strip markdown code-block fences (```json ... ```) from AI responses */
function stripCodeBlock(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return match ? match[1]!.trim() : trimmed;
}

async function generateGapAnalysis(
  workspace: any,
  payload: {
    capabilities: Array<{
      name: string;
      level: string;
      currentMaturity: string;
      targetMaturity: string;
      strategicImportance: string;
    }>;
  }
) {
  const capabilityList = payload.capabilities
    .map(
      (c) =>
        `- ${c.name} (${c.level}) | Importance: ${c.strategicImportance} | Current: ${c.currentMaturity} → Target: ${c.targetMaturity}`
    )
    .join("\n");

  const prompt = `You are a senior enterprise architect preparing a capability gap analysis for a consulting client.

CLIENT: ${workspace.clientName || workspace.name}
INDUSTRY: ${workspace.industry}

CAPABILITY ASSESSMENT DATA:
${capabilityList}

TASK:
Write a professional gap analysis narrative (400-600 words) that:
1. Opens with a high-level executive summary of the organization's overall capability maturity position
2. Identifies the 3 most critical capability gaps (highest importance + largest current-to-target delta)
3. Groups capabilities into: Strengths (Managed/Optimizing), Developing Areas, and Urgent Gaps (Initial + Critical importance)
4. Closes with a forward-looking paragraph on transformation focus areas

TONE: Objective, data-driven, consultant-grade. Suitable for a C-suite presentation.
FORMAT: Plain prose with section headers. No bullet points. No markdown tables.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  return Response.json({ narrative: (message.content[0] as any).text });
}

async function generateInvestmentPriorities(
  workspace: any,
  payload: {
    budget: "CONSTRAINED" | "MODERATE" | "EXPANSIVE";
    timeHorizon: "6_MONTHS" | "1_YEAR" | "2_YEARS" | "3_PLUS_YEARS";
    capabilities: Array<{
      name: string;
      strategicImportance: string;
      currentMaturity: string;
      targetMaturity: string;
    }>;
  }
) {
  const prompt = `You are an enterprise architecture advisor recommending technology investment priorities.

CLIENT: ${workspace.clientName || workspace.name}
INDUSTRY: ${workspace.industry}
INVESTMENT BUDGET: ${payload.budget}
PLANNING HORIZON: ${payload.timeHorizon.replace(/_/g, " ")}

CAPABILITY SCORES:
${payload.capabilities.map((c) => `- ${c.name}: Importance=${c.strategicImportance}, Current=${c.currentMaturity}, Target=${c.targetMaturity}`).join("\n")}

TASK:
Produce a prioritized investment roadmap in JSON format. Rank capabilities by: (strategic importance x maturity gap).
Account for budget constraints — constrained budgets should focus only on CRITICAL + HIGH importance gaps.

OUTPUT FORMAT (JSON only):
{
  "prioritized": [
    {
      "capabilityName": "string",
      "priority": 1,
      "investmentRationale": "string (1 sentence)",
      "estimatedEffort": "LOW" | "MEDIUM" | "HIGH",
      "suggestedTimeline": "string (e.g. Q1 2026)",
      "dependencies": ["string"]
    }
  ],
  "executiveSummary": "string (2-3 sentences)"
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const text = (message.content[0] as any).text;
    const parsed = JSON.parse(stripCodeBlock(text));
    return Response.json(parsed);
  } catch {
    return Response.json(
      { prioritized: [], error: "Failed to parse AI response" },
      { status: 200 }
    );
  }
}
