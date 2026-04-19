import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { rateLimit } from "@/lib/rate-limit";
import { anthropic as client } from "@/server/ai/client";
import { MODEL_SONNET } from "@/server/ai/models";

const MODEL = MODEL_SONNET;
const PROMPT_VERSION = "v1.2-capability-insights";

export const maxDuration = 30;

const SYSTEM_PROMPT = `You are a senior Enterprise Architect analyzing a single business capability.
The user is skimming a side panel — give them decision-ready insight in
under 350 output tokens. Direct, specific, no jargon.

## INPUT

You receive a JSON object:
{
  "capability": {
    "id", "name", "description", "level" ("L1"|"L2"|"L3"),
    "maturity": { "current": int|null, "target": int|null, "gap": int|null },
    "ownerName": string|null,
    "businessOwnerName": string|null,
    "itOwnerName": string|null,
    "valueStream": string|null,
    "totalInvestmentUsd": number|null
  },
  "applications": [
    { "id", "name", "vendor", "lifecycle", "businessValue", "technicalHealth",
      "annualCostUsd": number|null, "relationshipType": "PRIMARY"|"SUPPORTING"|"ENABLING" }
  ],
  "risks": [
    { "id", "title", "status", "riskScore", "category" }
  ],
  "initiatives": [
    { "id", "name", "status", "category", "progressPct", "impactType", "targetMaturity" }
  ],
  "objectives": [
    { "id", "name", "alignment": "STRONG"|"MODERATE"|"WEAK" }
  ],
  "organization": {
    "industry", "subIndustry"|null, "region"|null
  }
}

## VERDICT DECISION TREE (evaluate in order, first match wins)

1. capability.description is empty AND maturity.current is null
   AND applications.length === 0 AND risks.length === 0
   → "INSUFFICIENT_DATA"
2. applications.length === 0 OR capability.ownerName is null
   → "UNDERSERVED"
3. (maturity.gap ≥ 2) OR (open risks ≥ 2) OR
   (any application.lifecycle in ["SUNSET","RETIRED"])
   → "AT_RISK"
4. Otherwise → "HEALTHY"

## COVERAGE PATTERNS — flag in concerns when observed

- ORPHAN: 0 apps mapped
- REDUNDANT: 5+ apps mapped (potential consolidation candidate)
- FRAGILE: 1 app mapped AND it's SUNSET/RETIRED
- UNOWNED: ownerName AND businessOwnerName are both null (quick-win recommendation)
- OVERSPEND: totalInvestmentUsd > $1M AND maturity gap ≥ 2 (investing heavily but underperforming)
- UNDERFUNDED: totalInvestmentUsd is null/0 AND strategicImportance is CRITICAL/HIGH
- STALLED_INITIATIVE: linked initiative has progressPct < 20 AND status IN_PROGRESS for > 6 months
- UNALIGNED: no objectives linked (no strategic alignment visibility)

## OUTPUT FORMAT (strict JSON, no streaming, no markdown code fences)

{
  "healthVerdict": "HEALTHY" | "AT_RISK" | "UNDERSERVED" | "INSUFFICIENT_DATA",
  "headline": string,
  "strengths":   string[],
  "concerns":    string[],
  "recommendations": [
    {
      "action":  string,
      "effort":  "LOW" | "MED" | "HIGH",
      "impact":  "LOW" | "MED" | "HIGH"
    }
  ],
  "benchmark": string | null
}

## RULES

1. NEVER invent entity IDs. Cite only IDs present in INPUT.
2. Concerns describe what is wrong; recommendations describe what to do.
   Never repeat the same point in both.
3. Each recommendation must cite a specific app/risk from INPUT when its
   issue is tied to a concrete entity.
4. Benchmarks are qualitative ONLY — never quantitative ("typically
   digital-first" is fine; "has maturity 3.2" is not). Null when industry
   is GENERIC.
5. For INSUFFICIENT_DATA verdict: leave strengths and concerns empty;
   fill recommendations with 2-3 data-completeness actions
   (e.g. "Add a description", "Map at least one application",
   "Assign an owner"). Set benchmark to null.
6. Max 350 output tokens. Quality over quantity.
7. headline: max 18 words, one sentence.
8. strengths/concerns/recommendations: max 3 items each.

## EXAMPLES

### Example 1 — Healthy capability
INPUT: capability "Customer Onboarding" (L2, maturity 4/4),
  3 mapped apps (Salesforce, Onfido, DocuSign, all ACTIVE, HIGH BV),
  1 open risk score 30,
  industry "BANKING", subIndustry "Retail Banking"

OUTPUT:
{"healthVerdict":"HEALTHY","headline":"Customer Onboarding is well-supported and meeting its maturity target.","strengths":["Maturity at target (4/4) with 3 complementary apps covering identity, signing, and CRM","Low residual risk (single open risk, score 30)"],"concerns":[],"recommendations":[{"action":"Add KPIs (conversion rate, time-to-onboard) to make the health state monitorable","effort":"LOW","impact":"MED"}],"benchmark":"In Retail Banking, Customer Onboarding is typically digital-first with 3+ integrated apps."}

### Example 2 — Insufficient data
INPUT: capability "Treasury Management" (L2, maturity null),
  description empty, 0 apps, 0 risks, industry "BANKING"

OUTPUT:
{"healthVerdict":"INSUFFICIENT_DATA","headline":"Not enough data to assess Treasury Management.","strengths":[],"concerns":[],"recommendations":[{"action":"Add a description explaining what this capability delivers","effort":"LOW","impact":"HIGH"},{"action":"Map at least one application that supports this capability","effort":"LOW","impact":"HIGH"},{"action":"Assign an owner and set current/target maturity","effort":"LOW","impact":"MED"}],"benchmark":null}

### Example 3 — At-risk capability
INPUT: capability "Order Management" (L2, maturity 2/4, gap 2),
  apps: [Oracle EBS (SUNSET, MED BV, LOW TH), NetSuite (ACTIVE)],
  risks: [2 open, one score 85 titled "Oracle EBS EOL 2026"],
  industry "RETAIL"

OUTPUT:
{"healthVerdict":"AT_RISK","headline":"Order Management is running on a sunsetting Oracle EBS with an active EOL risk.","strengths":["NetSuite is in place as a potential successor"],"concerns":["FRAGILE: core flow depends on Oracle EBS (SUNSET, low technical health)","Open high-score risk (85) for Oracle EBS EOL in 2026","Maturity gap of 2 levels"],"recommendations":[{"action":"Define a migration plan from Oracle EBS to NetSuite with a 2025 target","effort":"HIGH","impact":"HIGH"},{"action":"Assign a named owner to drive the EOL remediation (risk_xyz)","effort":"LOW","impact":"MED"}],"benchmark":"In Retail, Order Management is typically consolidated on a modern commerce platform."}
`;

function stripCodeBlock(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return match ? match[1]!.trim() : trimmed;
}

function classifyError(err: any): { code: string; friendly: string; retriable: boolean } {
  const raw = typeof err?.message === "string" ? err.message : String(err ?? "");
  const status = err?.status;
  if (/overloaded/i.test(raw) || status === 529) {
    return { code: "overloaded", friendly: "Claude is temporarily overloaded. Please try again in a moment.", retriable: true };
  }
  if (status === 429 || /rate.?limit/i.test(raw)) {
    return { code: "rate_limited", friendly: "Claude is rate-limited right now — try again shortly.", retriable: true };
  }
  if (status && status >= 500) {
    return { code: "upstream", friendly: "Claude is having issues. Please retry.", retriable: true };
  }
  return { code: "unknown", friendly: "Something went wrong. Please try again.", retriable: false };
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, capabilityId } = await req.json();
  if (!capabilityId) {
    return Response.json({ error: "capabilityId required" }, { status: 400 });
  }

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId },
    include: { user: true },
  });
  if (!workspace || workspace.user.clerkId !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { allowed } = rateLimit(`cap-insights:${userId}`, { maxRequests: 15, windowMs: 60_000 });
  if (!allowed) {
    return Response.json({ error: "Rate limit: 15 per minute" }, { status: 429 });
  }

  // Load capability + mapped apps + linked risks + initiatives
  const capability = await db.businessCapability.findFirst({
    where: { id: capabilityId, workspaceId, isActive: true },
    include: {
      owner: { select: { name: true } },
      businessOwner: { select: { name: true } },
      itOwner: { select: { name: true } },
      valueStream: { select: { name: true } },
      objectives: {
        include: { objective: { select: { id: true, name: true } } },
      },
      applicationMappings: {
        include: {
          application: {
            select: {
              id: true, name: true, vendor: true, lifecycle: true,
              businessValue: true, technicalHealth: true,
              annualCostUsd: true,
            },
          },
        },
      },
    },
  });
  if (!capability) {
    return Response.json({ error: "Capability not found" }, { status: 404 });
  }

  const risks = await db.techRisk.findMany({
    where: {
      workspaceId,
      capabilityLinks: { some: { capabilityId } },
    },
    select: {
      id: true, title: true, status: true, riskScore: true, category: true,
    },
    take: 20,
  }).catch(() => []);

  // Load initiatives that target this capability
  const initiativeLinks = await db.initiativeCapabilityMap.findMany({
    where: { capabilityId, workspaceId },
    include: {
      initiative: {
        select: {
          id: true, name: true, status: true, category: true,
          progressPct: true, startDate: true, endDate: true,
        },
      },
    },
    take: 10,
  }).catch(() => [] as any[]);

  // Convert MaturityLevel enum ("LEVEL_0".."LEVEL_5" / "NOT_ASSESSED") to numeric
  function maturityNum(m: string | null | undefined): number | null {
    if (!m || m === "NOT_ASSESSED") return null;
    const match = /LEVEL_(\d)/.exec(m);
    return match ? parseInt(match[1]!, 10) : null;
  }
  const current = maturityNum(capability.currentMaturity);
  const target = maturityNum(capability.targetMaturity);
  const gap = current !== null && target !== null ? Math.max(0, target - current) : null;

  // Compute total weighted investment
  const WEIGHTS: Record<string, number> = { PRIMARY: 1.0, SUPPORTING: 0.5, ENABLING: 0.25 };
  const totalInvestment = capability.applicationMappings.reduce((sum, m) => {
    const cost = m.application.annualCostUsd ? Number(m.application.annualCostUsd) : 0;
    const weight = WEIGHTS[m.relationshipType] ?? 1.0;
    return sum + cost * weight;
  }, 0);

  const input = {
    capability: {
      id: capability.id,
      name: capability.name,
      description: capability.description ?? "",
      level: capability.level,
      maturity: { current, target, gap },
      ownerName: capability.owner?.name ?? null,
      businessOwnerName: capability.businessOwner?.name ?? null,
      itOwnerName: capability.itOwner?.name ?? null,
      valueStream: capability.valueStream?.name ?? null,
      totalInvestmentUsd: totalInvestment > 0 ? totalInvestment : null,
    },
    applications: capability.applicationMappings.map((m) => ({
      ...m.application,
      annualCostUsd: m.application.annualCostUsd ? Number(m.application.annualCostUsd) : null,
      relationshipType: m.relationshipType,
    })),
    risks,
    initiatives: initiativeLinks.map((il: any) => ({
      id: il.initiative.id,
      name: il.initiative.name,
      status: il.initiative.status,
      category: il.initiative.category,
      progressPct: il.initiative.progressPct,
      impactType: il.impactType,
      targetMaturity: il.targetMaturity,
    })),
    objectives: capability.objectives.map((o: any) => ({
      id: o.objective.id,
      name: o.objective.name,
      alignment: o.alignment,
    })),
    organization: {
      industry: workspace.industry,
      subIndustry: (workspace as any).subIndustry ?? null,
      region: (workspace as any).region ?? null,
    },
  };

  async function run() {
    return client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `INPUT:\n${JSON.stringify(input)}` }],
    });
  }

  let attempts = 0;
  const MAX = 2;
  let response: Awaited<ReturnType<typeof run>> | null = null;
  let lastError: any = null;

  while (attempts < MAX) {
    attempts++;
    try {
      response = await run();
      break;
    } catch (err: any) {
      lastError = err;
      const info = classifyError(err);
      if (info.retriable && attempts < MAX) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      return Response.json({ error: info.friendly, code: info.code }, { status: 502 });
    }
  }

  if (!response) {
    const info = classifyError(lastError);
    return Response.json({ error: info.friendly }, { status: 502 });
  }

  const textBlock = response.content.find((b: any) => b.type === "text") as { text: string } | undefined;
  const raw = textBlock?.text ?? "";

  let parsed: any = null;
  try {
    parsed = JSON.parse(stripCodeBlock(raw));
  } catch {
    return Response.json({ error: "Failed to parse AI response", raw }, { status: 502 });
  }

  return Response.json({ insights: parsed, promptVersion: PROMPT_VERSION });
}
