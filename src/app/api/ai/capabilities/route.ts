import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

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
    existingL1s: string[];
    existingL2s: string[];
  }
) {
  const prompt = `You are an enterprise architecture expert specializing in business capability modeling.

CONTEXT:
- Industry: ${payload.industry}
- Existing Level 1 (L1) capabilities already defined: ${payload.existingL1s.map((n) => `"${n}"`).join(", ") || "None"}
- Existing Level 2 (L2) capabilities already defined: ${payload.existingL2s.map((n) => `"${n}"`).join(", ") || "None"}

TASK:
Identify business capabilities that are MISSING from this organization's capability map based on industry best practices.

RULES:
- Only suggest capabilities that are genuinely absent — do not duplicate existing ones
- Capabilities must describe WHAT the business does, not HOW (no process steps, no technology names)
- Maximum 3 levels deep (L1, L2, L3)
- Each suggestion must be mutually exclusive from existing capabilities
- Focus on capabilities that have the highest strategic and operational impact
- Suggest 5-8 capabilities total

OUTPUT FORMAT (JSON only, no markdown, no explanation):
{
  "suggestions": [
    {
      "name": "string",
      "level": "L1" | "L2" | "L3",
      "suggestedParent": "string | null",
      "rationale": "string (1-2 sentences)",
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
    const parsed = JSON.parse(text);
    return Response.json(parsed);
  } catch {
    return Response.json(
      { suggestions: [], error: "Failed to parse AI response" },
      { status: 200 }
    );
  }
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
    const parsed = JSON.parse(text);
    return Response.json(parsed);
  } catch {
    return Response.json(
      { prioritized: [], error: "Failed to parse AI response" },
      { status: 200 }
    );
  }
}
