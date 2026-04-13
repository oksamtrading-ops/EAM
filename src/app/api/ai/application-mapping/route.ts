import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { rateLimit } from "@/lib/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-20250514";
const PROMPT_VERSION = "v1.5";
const THINKING_BUDGET = 5000;
const MAX_BATCH_SIZE = 30;

export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { action, workspaceId, payload } = await req.json();

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId },
    include: { user: true },
  });
  if (!workspace || workspace.user.clerkId !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Separate rate limits per tier
  if (action === "suggest-single") {
    const { allowed } = rateLimit(`map-single:${userId}`, {
      maxRequests: 5,
      windowMs: 120_000,
    });
    if (!allowed) {
      return Response.json(
        { error: "Rate limit: 5 per 2 minutes. Please wait." },
        { status: 429 }
      );
    }
    return suggestSingle(workspace, payload);
  }

  if (action === "suggest-batch") {
    const { allowed } = rateLimit(`map-batch:${userId}`, {
      maxRequests: 1,
      windowMs: 300_000,
    });
    if (!allowed) {
      return Response.json(
        { error: "Batch rate limit: 1 per 5 minutes. Please wait." },
        { status: 429 }
      );
    }
    return suggestBatch(workspace, payload);
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

// ─── Helpers ─────────────────────────────────────────────

function stripCodeBlock(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return match ? match[1]!.trim() : trimmed;
}

type Cap = {
  id: string;
  name: string;
  description: string | null;
  level: string;
  parentId: string | null;
  strategicImportance: string;
};

/** Render capabilities as an indented tree to preserve hierarchy. */
function renderCapabilityTree(caps: Cap[]): string {
  const byParent = new Map<string | null, Cap[]>();
  for (const c of caps) {
    const key = c.parentId;
    byParent.set(key, [...(byParent.get(key) ?? []), c]);
  }

  const lines: string[] = [];
  function walk(parentId: string | null, depth: number) {
    const children = byParent.get(parentId) ?? [];
    for (const c of children) {
      const indent = "  ".repeat(depth);
      const desc = c.description ? ` — "${c.description.slice(0, 120)}"` : "";
      lines.push(
        `${indent}[${c.id}] ${c.name} (${c.level}, ${c.strategicImportance})${desc}`
      );
      walk(c.id, depth + 1);
    }
  }
  walk(null, 0);
  return lines.join("\n");
}

function buildIndustryContext(workspace: any): string {
  const parts = [
    `Industry: ${workspace.industry}`,
    `Sub-industry: ${workspace.subIndustry ?? "not specified"}`,
    `Region: ${workspace.region ?? "not specified"}`,
    `Regulatory regime: ${workspace.regulatoryRegime ?? "not specified"}`,
    `Business model: ${workspace.businessModelHint ?? "not specified"}`,
    `Client: ${workspace.clientName ?? workspace.name}`,
  ];
  return parts.join("\n");
}

const SYSTEM_PROMPT = `You are a Senior Enterprise Architect with 20+ years of experience mapping applications to business capabilities across Fortune 500 enterprises. You follow BIZBOK, APQC PCF, and industry-specific reference frameworks (BIAN banking, eTOM telecom, ACORD insurance, SCOR supply chain, HIMSS healthcare).

CRITICAL RULES:
- NEVER invent capability IDs. Only use IDs from the provided list.
- NEVER suggest capabilities not in the provided list, even if you think they should exist.
- If no capability fits with confidence >=50, return empty suggestions.
- Output VALID JSON only. No markdown fences, no commentary outside JSON.

VENDOR KNOWLEDGE SHORTCUT:
If the vendor is a well-known SaaS with a clear primary capability, anchor on that with 90+ confidence:
  - Salesforce -> Sales / CRM capabilities
  - Workday -> HCM / Payroll / Talent
  - ServiceNow -> IT Service Management
  - SAP S/4HANA -> ERP (suite, expect 10+ mappings)
  - Microsoft 365 -> Collaboration, Email, Document Management (suite)
  - Oracle EBS -> ERP suite
  - Atlassian Jira -> Software Delivery / Issue Tracking
  - Snowflake / Databricks -> Data Warehousing / Analytics
  - Okta / Auth0 -> Identity & Access Management
  - Stripe / Adyen -> Payment Processing
  - Zendesk / Intercom -> Customer Service
  - Marketo / HubSpot -> Marketing Automation
  - Oracle NetSuite -> ERP (SMB/Mid-market)

RELATIONSHIP TYPE:
- PRIMARY: app directly delivers this capability as its core function
- SUPPORTING: app provides significant features that help deliver this capability but isn't the primary system
- ENABLING: app enables operation of this capability (monitoring, infrastructure, security) without being the capability itself

FEW-SHOT EXAMPLES:

Example 1 - Clear match:
Input: { name: "Salesforce Sales Cloud", vendor: "Salesforce", description: "CRM for sales team" }
Suggestion: Lead Management (95, PRIMARY) — "Salesforce Sales Cloud is the market-leading CRM; Lead Management is its core delivered capability." Evidence: vendor, name, description.

Example 2 - Ambiguous / insufficient data:
Input: { name: "CustomerHub", vendor: "Internal", description: "" }
Output: empty suggestions.
dataQualityNote: "Name is generic and description is blank. Could be CRM, customer portal, or support tool. Recommend adding description before AI mapping."

Example 3 - Enabling relationship:
Input: { name: "Datadog", vendor: "Datadog", description: "Infrastructure monitoring" }
Suggestion: IT Operations (88, ENABLING) — "Datadog provides observability that enables IT Operations; it does not itself deliver the capability." Evidence: vendor, description.`;

function buildUserPrompt({
  app,
  capabilities,
  existingIds,
  rejectedIds,
  industryContext,
  includeCeiling,
}: {
  app: any;
  capabilities: Cap[];
  existingIds: string[];
  rejectedIds: string[];
  industryContext: string;
  includeCeiling: boolean;
}): string {
  const existingNames = capabilities
    .filter((c) => existingIds.includes(c.id))
    .map((c) => c.name);
  const rejectedNames = capabilities
    .filter((c) => rejectedIds.includes(c.id))
    .map((c) => c.name);

  return `# Organization Context
${industryContext}

# Application to Map
Name: ${app.name}
Vendor: ${app.vendor ?? "(unknown)"}
Description: ${app.description ?? "(blank — rely on name + vendor + industry priors)"}
Type: ${app.applicationType}
Lifecycle: ${app.lifecycle}
Business Value: ${app.businessValue}
Technical Health: ${app.technicalHealth}
Business Owner: ${app.businessOwnerName ?? "not assigned"}
IT Owner: ${app.itOwnerName ?? "not assigned"}

# Capability Tree (USE ONLY THESE IDs)
${renderCapabilityTree(capabilities)}

# Already-Mapped Capabilities (DO NOT RE-SUGGEST)
${existingNames.length ? existingNames.join(", ") : "none"}

# Recently Rejected Suggestions (DO NOT RE-SUGGEST)
${rejectedNames.length ? rejectedNames.join(", ") : "none"}

# Instructions
1. Suggest 3-8 capabilities (up to 15 if this is a suite/platform like SAP S/4HANA, Microsoft 365, Oracle EBS).
2. Only use capability IDs from the tree above. Never invent IDs.
3. Exclude already-mapped and recently-rejected capabilities.
4. Prefer Level 2 or Level 3 capabilities over Level 1 (more specific).
5. Confidence bands:
   - 90-100: name/vendor/description unambiguously matches (e.g., known vendor + matching cap name)
   - 70-89: strong match based on vendor + app type + industry pattern
   - 50-69: reasonable inference from partial data
   - <50: do not return
6. ${includeCeiling ? "For any suggestion with confidence >=85, include confidenceCeiling (what evidence would raise it to 100)." : "Skip confidenceCeiling field."}
7. If data is insufficient for any suggestion >=50 confidence, return empty suggestions with dataQualityNote.

# Output (JSON only — no markdown fences)
{
  "suggestions": [
    {
      "capabilityId": "string (from tree)",
      "capabilityName": "string",
      "confidence": number,
      "relationshipType": "PRIMARY" | "SUPPORTING" | "ENABLING",
      "rationale": "string (1-2 sentences, cite specific evidence)",
      "evidenceFields": ["name" | "vendor" | "description" | "type" | "vendor_knowledge" | "industry_pattern"],
      "confidenceCeiling": "string or null"
    }
  ],
  "dataQualityNote": "string or null",
  "isSuite": boolean
}`;
}

// ─── Precision tier: single app with extended thinking ──

async function suggestSingle(workspace: any, payload: { application: any; capabilities: Cap[]; existingCapabilityIds: string[]; recentlyRejectedCapabilityIds: string[] }) {
  const started = Date.now();
  const industryContext = buildIndustryContext(workspace);

  const userPrompt = buildUserPrompt({
    app: payload.application,
    capabilities: payload.capabilities,
    existingIds: payload.existingCapabilityIds,
    rejectedIds: payload.recentlyRejectedCapabilityIds,
    industryContext,
    includeCeiling: true,
  });

  let parsed: any = { suggestions: [], dataQualityNote: null, isSuite: false };
  let tokensUsed = 0;
  let errorMessage: string | null = null;

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "enabled", budget_tokens: THINKING_BUDGET } as any,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    // Find the text block (thinking block is separate)
    const textBlock = message.content.find((b: any) => b.type === "text") as any;
    const text = textBlock?.text ?? "";
    tokensUsed = (message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0);
    parsed = JSON.parse(stripCodeBlock(text));
  } catch (err: any) {
    errorMessage = err?.message ?? "AI call failed";
  }

  // Enforce: only keep suggestions with valid capability IDs
  const validIds = new Set(payload.capabilities.map((c) => c.id));
  parsed.suggestions = (parsed.suggestions ?? []).filter((s: any) =>
    validIds.has(s.capabilityId)
  );

  // Log run
  await db.aIMappingRun.create({
    data: {
      workspaceId: workspace.id,
      mode: "single",
      tier: "precision",
      appsProcessed: 1,
      suggestionsGenerated: parsed.suggestions?.length ?? 0,
      tokensUsed,
      durationMs: Date.now() - started,
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      status: errorMessage ? "failed" : "completed",
      errorMessage,
      createdById: workspace.userId,
    },
  });

  return Response.json({
    ...parsed,
    meta: {
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      tier: "precision",
      tokensUsed,
      durationMs: Date.now() - started,
    },
  });
}

// ─── Fast tier: batch of up to 30 apps ──────────────────

async function suggestBatch(
  workspace: any,
  payload: {
    applications: any[];
    capabilities: Cap[];
  }
) {
  const started = Date.now();
  const industryContext = buildIndustryContext(workspace);
  const apps = payload.applications.slice(0, MAX_BATCH_SIZE);
  const validIds = new Set(payload.capabilities.map((c) => c.id));

  const results: Record<string, any> = {};
  let totalTokens = 0;

  // Process sequentially to keep within per-request token limits
  for (const app of apps) {
    const userPrompt = buildUserPrompt({
      app,
      capabilities: payload.capabilities,
      existingIds: app.existingCapabilityIds ?? [],
      rejectedIds: app.recentlyRejectedCapabilityIds ?? [],
      industryContext,
      includeCeiling: false,
    });

    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      const textBlock = message.content.find((b: any) => b.type === "text") as any;
      const text = textBlock?.text ?? "";
      totalTokens +=
        (message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0);

      const parsed = JSON.parse(stripCodeBlock(text));
      parsed.suggestions = (parsed.suggestions ?? []).filter((s: any) =>
        validIds.has(s.capabilityId)
      );
      results[app.id] = parsed;
    } catch (err: any) {
      results[app.id] = {
        suggestions: [],
        dataQualityNote: `Error: ${err?.message ?? "parse failed"}`,
        isSuite: false,
      };
    }
  }

  const totalSuggestions = Object.values(results).reduce(
    (sum, r: any) => sum + (r.suggestions?.length ?? 0),
    0
  );

  await db.aIMappingRun.create({
    data: {
      workspaceId: workspace.id,
      mode: "batch",
      tier: "fast",
      appsProcessed: apps.length,
      suggestionsGenerated: totalSuggestions,
      tokensUsed: totalTokens,
      durationMs: Date.now() - started,
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      status: "completed",
      createdById: workspace.userId,
    },
  });

  return Response.json({
    results,
    meta: {
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      tier: "fast",
      tokensUsed: totalTokens,
      durationMs: Date.now() - started,
      appsProcessed: apps.length,
    },
  });
}
