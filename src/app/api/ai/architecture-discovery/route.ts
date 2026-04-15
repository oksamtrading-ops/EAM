import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { rateLimit } from "@/lib/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-20250514";
const PROMPT_VERSION = "arch-v1.0";
const THINKING_BUDGET = 5000;

export const maxDuration = 60;

type Mode = "global" | "per-app";
type Scenario = "AS_IS" | "TO_BE";

type AppLite = {
  id: string;
  name: string;
  vendor: string | null;
  description: string | null;
  applicationType: string;
  systemLandscapeRole: string | null;
  businessCapabilityKeywords: string | null;
  technicalStackKeywords: string | null;
  lifecycle: string;
};

type ExistingEdge = {
  sourceAppId: string;
  targetAppId: string;
  name: string;
  reviewStatus: "PENDING" | "ACCEPTED" | "REJECTED";
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const mode: Mode = body.mode === "per-app" ? "per-app" : "global";
  const scenario: Scenario = body.scenario === "TO_BE" ? "TO_BE" : "AS_IS";
  const scopeAppId: string | undefined = body.scopeAppId;

  // Resolve workspace via the authenticated user (same pattern as other AI routes
  // that call auth → check user owns workspace).
  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, workspaces: { select: { id: true }, take: 1 } },
  });
  if (!user) return Response.json({ error: "User not found" }, { status: 401 });

  const workspaceId: string | undefined = body.workspaceId ?? user.workspaces[0]?.id;
  if (!workspaceId) {
    return Response.json({ error: "No workspace" }, { status: 400 });
  }

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, userId: user.id },
  });
  if (!workspace) return Response.json({ error: "Forbidden" }, { status: 403 });

  // Rate limit — 1 global per 5 min, 5 per-app per 2 min
  const limitKey = mode === "global" ? `arch-global:${userId}` : `arch-perapp:${userId}`;
  const limit =
    mode === "global"
      ? { maxRequests: 1, windowMs: 300_000 }
      : { maxRequests: 5, windowMs: 120_000 };
  const { allowed } = rateLimit(limitKey, limit);
  if (!allowed) {
    return Response.json(
      {
        error:
          mode === "global"
            ? "Rate limit: 1 global discovery per 5 minutes. Please wait."
            : "Rate limit: 5 per-app discoveries per 2 minutes.",
      },
      { status: 429 }
    );
  }

  const started = Date.now();

  const apps = await db.application.findMany({
    where: { workspaceId, isActive: true },
    select: {
      id: true,
      name: true,
      vendor: true,
      description: true,
      applicationType: true,
      systemLandscapeRole: true,
      businessCapabilityKeywords: true,
      technicalStackKeywords: true,
      lifecycle: true,
    },
    orderBy: { name: "asc" },
  });

  if (apps.length < 2) {
    return Response.json(
      { error: "Need at least 2 applications to discover integrations" },
      { status: 400 }
    );
  }

  // Existing edges in scenario — skip ACCEPTED + REJECTED + PENDING so we don't
  // re-suggest anything the user has already seen or decided on.
  const existingEdges = await db.applicationInterface.findMany({
    where: { workspaceId, scenario, isActive: true },
    select: {
      sourceAppId: true,
      targetAppId: true,
      name: true,
      reviewStatus: true,
    },
  });

  // Scope — if per-app, filter to apps touching scopeAppId
  const scopedApps =
    mode === "per-app" && scopeAppId
      ? apps.filter((a) => a.id === scopeAppId || true) // send all apps, but the prompt is narrowed below
      : apps;
  const focusApp: AppLite | null =
    mode === "per-app" && scopeAppId
      ? apps.find((a) => a.id === scopeAppId) ?? null
      : null;

  const prompt = buildPrompt({
    workspace,
    apps: scopedApps,
    existingEdges,
    focusApp,
  });

  let parsed: { suggestions: Suggestion[] } = { suggestions: [] };
  let tokensUsed = 0;
  let errorMessage: string | null = null;

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 12000,
      thinking: { type: "enabled", budget_tokens: THINKING_BUDGET } as any,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = message.content.find((b: any) => b.type === "text") as any;
    const text = textBlock?.text ?? "";
    tokensUsed = (message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0);
    parsed = JSON.parse(stripCodeBlock(text));
  } catch (err: any) {
    errorMessage = err?.message ?? "AI call failed";
  }

  // Validate: filter suggestions to known app IDs, non-self-loops, non-duplicates
  const appIds = new Set(apps.map((a) => a.id));
  // Lookup by (src|tgt|name) so we don't re-create rows that already exist
  // regardless of review status — including REJECTED (user said no).
  const existingKey = new Set(
    existingEdges.map((e) => `${e.sourceAppId}|${e.targetAppId}|${e.name.toLowerCase()}`)
  );

  const valid: Suggestion[] = (parsed.suggestions ?? []).filter((s) => {
    if (!s || typeof s !== "object") return false;
    if (!appIds.has(s.sourceAppId) || !appIds.has(s.targetAppId)) return false;
    if (s.sourceAppId === s.targetAppId) return false;
    if (typeof s.confidence !== "number" || s.confidence < 50) return false;
    const key = `${s.sourceAppId}|${s.targetAppId}|${(s.name ?? "").toLowerCase()}`;
    if (existingKey.has(key)) return false;
    return true;
  });

  // Insert suggestions as PENDING
  let suggestionsGenerated = 0;
  for (const s of valid) {
    try {
      await db.applicationInterface.create({
        data: {
          workspaceId,
          sourceAppId: s.sourceAppId,
          targetAppId: s.targetAppId,
          name: s.name.slice(0, 200),
          description: s.description?.slice(0, 500) ?? null,
          protocol: normalizeProtocol(s.protocol),
          direction: "OUTBOUND",
          criticality: normalizeCriticality(s.criticality),
          status: "INT_ACTIVE",
          dataFlowDescription: s.dataFlowDescription?.slice(0, 500) ?? null,
          scenario,
          source: "AI_SUGGESTED",
          reviewStatus: "PENDING",
          aiConfidence: Math.round(s.confidence),
          aiRationale: s.rationale?.slice(0, 800) ?? null,
          aiModel: MODEL,
          aiPromptVersion: PROMPT_VERSION,
          createdById: user.id,
        },
      });
      suggestionsGenerated++;
    } catch {
      // Most likely a race / unique-key conflict — skip silently.
    }
  }

  await db.aIArchitectureRun.create({
    data: {
      workspaceId,
      mode,
      scopeAppId: scopeAppId ?? null,
      appsProcessed: scopedApps.length,
      suggestionsGenerated,
      tokensUsed,
      durationMs: Date.now() - started,
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      status: errorMessage ? "failed" : "completed",
      errorMessage,
      createdById: user.id,
    },
  });

  return Response.json({
    mode,
    scenario,
    appsProcessed: scopedApps.length,
    suggestionsGenerated,
    tokensUsed,
    durationMs: Date.now() - started,
    error: errorMessage,
  });
}

// ─── Prompting ────────────────────────────────────────────

type Suggestion = {
  sourceAppId: string;
  targetAppId: string;
  name: string;
  description?: string;
  protocol?: string;
  criticality?: string;
  dataFlowDescription?: string;
  confidence: number;
  rationale?: string;
};

const SYSTEM_PROMPT = `You are a Senior Enterprise Integration Architect with 20+ years of experience designing system landscapes across Fortune 500 enterprises. You have deep knowledge of common SaaS integration patterns (Salesforce ↔ Marketo, Workday ↔ ServiceNow, SAP ↔ CRM, etc.).

CRITICAL RULES:
- Only propose integrations between applications in the provided list.
- NEVER invent application IDs.
- NEVER propose self-loops (source == target).
- NEVER propose duplicates of integrations already in the "Existing" list — including REJECTED ones.
- Output VALID JSON only. No markdown fences, no commentary outside JSON.
- Confidence 50-69: reasonable inference; 70-89: strong vendor/pattern match; 90-100: canonical integration (e.g., Workday → payroll provider).`;

function buildPrompt({
  workspace,
  apps,
  existingEdges,
  focusApp,
}: {
  workspace: any;
  apps: AppLite[];
  existingEdges: ExistingEdge[];
  focusApp: AppLite | null;
}): string {
  const appCatalog = apps
    .map((a) => {
      const meta = [
        a.vendor ? `vendor=${a.vendor}` : null,
        a.applicationType ? `type=${a.applicationType}` : null,
        a.systemLandscapeRole ? `role=${a.systemLandscapeRole}` : null,
        a.businessCapabilityKeywords ? `caps=${a.businessCapabilityKeywords}` : null,
        a.technicalStackKeywords ? `stack=${a.technicalStackKeywords}` : null,
      ]
        .filter(Boolean)
        .join("; ");
      const desc = a.description ? ` — "${a.description.slice(0, 150)}"` : "";
      return `[${a.id}] ${a.name}${meta ? ` (${meta})` : ""}${desc}`;
    })
    .join("\n");

  const existingList = existingEdges.length
    ? existingEdges
        .map(
          (e) =>
            `- ${e.sourceAppId} → ${e.targetAppId} "${e.name}" [${e.reviewStatus}]`
        )
        .join("\n")
    : "(none)";

  const industry = [
    workspace.industry,
    workspace.subIndustry,
    workspace.businessModelHint,
  ]
    .filter(Boolean)
    .join(" / ");

  const focusSection = focusApp
    ? `\n# FOCUS
Only propose integrations where the source OR target is [${focusApp.id}] ${focusApp.name}. Ignore integrations that don't involve this app.\n`
    : "";

  return `# Organization
${industry || "(not specified)"}
Client: ${workspace.clientName ?? workspace.name}

# Application Catalog (USE ONLY THESE IDs)
${appCatalog}

# Existing Integrations (DO NOT re-propose these, even if REJECTED)
${existingList}
${focusSection}
# Instructions
Propose likely integrations between these applications based on:
1. Known vendor integration patterns (e.g., Salesforce ↔ Marketing automation; Workday ↔ ServiceNow for HR tickets).
2. System landscape roles (e.g., "System of Record" feeds "Analytics" apps).
3. Business capability overlap (apps serving related capabilities often integrate).
4. Technical stack clues (e.g., same cloud provider, shared data formats).

For each proposed integration, choose the most likely:
- protocol: one of REST_API, SOAP, GRAPHQL, FILE_TRANSFER, DATABASE_LINK, MESSAGE_QUEUE, EVENT_STREAM, ETL, SFTP, CUSTOM
- criticality: one of INT_CRITICAL, INT_HIGH, INT_MEDIUM, INT_LOW
- confidence: 50-100 (skip anything <50)

Prefer fewer high-confidence suggestions over many low-confidence ones. Cap at 30 suggestions total.

# Output (JSON only)
{
  "suggestions": [
    {
      "sourceAppId": "string (from catalog)",
      "targetAppId": "string (from catalog)",
      "name": "string (short, e.g. 'User sync', 'Order events')",
      "description": "string (1 sentence)",
      "protocol": "REST_API | SOAP | ...",
      "criticality": "INT_CRITICAL | INT_HIGH | INT_MEDIUM | INT_LOW",
      "dataFlowDescription": "string (what data moves)",
      "confidence": number,
      "rationale": "string (1-2 sentences, cite specific evidence)"
    }
  ]
}`;
}

function stripCodeBlock(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return match ? match[1]!.trim() : trimmed;
}

const PROTOCOLS = new Set([
  "REST_API",
  "SOAP",
  "GRAPHQL",
  "FILE_TRANSFER",
  "DATABASE_LINK",
  "MESSAGE_QUEUE",
  "EVENT_STREAM",
  "ETL",
  "SFTP",
  "CUSTOM",
]);
function normalizeProtocol(p?: string): any {
  const up = (p ?? "").toUpperCase();
  return PROTOCOLS.has(up) ? up : "REST_API";
}

const CRITICALITIES = new Set(["INT_CRITICAL", "INT_HIGH", "INT_MEDIUM", "INT_LOW"]);
function normalizeCriticality(c?: string): any {
  const up = (c ?? "").toUpperCase();
  return CRITICALITIES.has(up) ? up : "INT_MEDIUM";
}
