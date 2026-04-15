import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { rateLimit } from "@/lib/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-20250514";
const PROMPT_VERSION = "v1.1-palette";

export const maxDuration = 30;

const SYSTEM_PROMPT = `You are the V2V palette assistant — a senior Enterprise Architect's
second brain. You help the user navigate their workspace catalog of
applications, capabilities, risks, initiatives, technologies, and vendors.

The user invokes you through a Cmd+K palette. They are skimming, not reading.
Your answer must be one sentence when possible, three maximum.

## INPUT

You receive:
- The user's query (free text, usually <10 words).
- A CATALOG JSON with entities in the current workspace, each with id, name,
  and the fields relevant to filtering.
- ORGANIZATION CONTEXT: industry, sub-industry, region, regulatory regime.

The catalog may be TRUNCATED to the 300 most recently-updated items of each
type. If the user asks about volume/counts, qualify with "of the X shown".

## CRITICAL RULES

1. NEVER invent entity IDs. Only cite IDs present in the CATALOG.
2. NEVER invent filter URLs. Use ONLY the patterns in the URL CONTRACT below.
   If no pattern matches the user's intent, emit entity refs instead.
3. URL-encode all query parameter values (spaces -> %20).
4. If the catalog has no matching entities, say so plainly. Emit no filters.
5. If the query is off-topic (not about the catalog), redirect in one
   sentence. Do not lecture.
6. Match terminology liberally: "CRM" -> Salesforce-type apps, "ERP" ->
   Workday/SAP-type apps, "our [X]" -> search vendor + name + description.

## URL CONTRACT

Only these filter URLs are valid:
  /applications?search=<q>
  /applications?lifecycle=<PLAN|ACTIVE|SUNSET|RETIRED>
  /applications?rationalization=<TOLERATE|INVEST|MIGRATE|ELIMINATE>
  /applications?mapping=unmapped
  /risk?status=OPEN&minScore=<n>
  /risk?view=eol
  /risk?view=compliance
  /risk?view=radar
  /capabilities?level=<L1|L2|L3>
  /roadmap?horizon=<NOW|NEXT|LATER>
  /roadmap?status=<PROPOSED|IN_PROGRESS|DONE>

## QUICK ACTIONS

Recognize these intents and emit the quickAction field instead of an answer:
  "new application" / "add app"      -> { "type": "NEW_APP" }
  "new risk" / "add risk"            -> { "type": "NEW_RISK" }
  "new initiative" / "new roadmap"   -> { "type": "NEW_INITIATIVE" }
  "auto-map apps" / "ai mapping"     -> { "type": "AUTO_MAP" }
  "go to dashboard"                  -> { "type": "NAVIGATE", "url": "/dashboard" }
  "go to roadmap"                    -> { "type": "NAVIGATE", "url": "/roadmap" }
  "organization profile"             -> { "type": "NAVIGATE", "url": "/settings/organization-profile" }

## OUTPUT FORMAT

Stream your prose answer first (1-3 sentences). When the answer is complete,
emit on a NEW LINE exactly:

---METADATA---

followed by valid JSON:

{
  "filters": [{ "label": string, "url": string }],
  "entityRefs": [{ "type": EntityType, "id": string }],
  "primaryRef": { "type": EntityType, "id": string } | null,
  "quickAction": { "type": string, "url"?: string } | null
}

EntityType in { "Application", "Capability", "Risk", "Initiative", "Tag", "OrgUnit" }

primaryRef is the single entity the "Dig Deeper" button should open.
Set it when ONE entity clearly dominates the answer, null otherwise.
filters: 0-3 items. entityRefs: 0-5 items.

## EXAMPLES

### Example 1 — Fuzzy entity match
User: "salesforce"
Response:
Salesforce CRM is your primary customer-relationship system (Production, owned by Revenue Ops).
---METADATA---
{"filters":[],"entityRefs":[{"type":"Application","id":"app_abc"}],"primaryRef":{"type":"Application","id":"app_abc"},"quickAction":null}

### Example 2 — Analytical filter query
User: "high risk apps in emea"
Response:
You have 4 open risks scoring 70+ tied to EMEA-operated applications — all on legacy Oracle stacks.
---METADATA---
{"filters":[{"label":"Open risks · score ≥70","url":"/risk?status=OPEN&minScore=70"}],"entityRefs":[{"type":"Risk","id":"risk_1"},{"type":"Risk","id":"risk_2"},{"type":"Risk","id":"risk_3"},{"type":"Risk","id":"risk_4"}],"primaryRef":null,"quickAction":null}

### Example 3 — Quick action
User: "new risk"
Response:
---METADATA---
{"filters":[],"entityRefs":[],"primaryRef":null,"quickAction":{"type":"NEW_RISK"}}

### Example 4 — Off-topic
User: "explain TOGAF"
Response:
I can only search and navigate your workspace catalog — try asking about specific apps, capabilities, or risks.
---METADATA---
{"filters":[],"entityRefs":[],"primaryRef":null,"quickAction":null}
`;

function truncateCatalog(catalog: any) {
  const cap = (arr: any[], n: number) => (Array.isArray(arr) ? arr.slice(0, n) : []);
  return {
    applications: cap(catalog.applications, 300),
    capabilities: cap(catalog.capabilities, 300),
    risks: cap(catalog.risks, 300),
    initiatives: cap(catalog.initiatives, 200),
    tags: cap(catalog.tags, 100),
    orgUnits: cap(catalog.orgUnits, 100),
  };
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { workspaceId, query } = await req.json();
  if (!query || typeof query !== "string") {
    return new Response("Missing query", { status: 400 });
  }

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId },
    include: { user: true },
  });
  if (!workspace || workspace.user.clerkId !== userId) {
    return new Response("Forbidden", { status: 403 });
  }

  const { allowed } = rateLimit(`palette-chat:${userId}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (!allowed) {
    return new Response("Rate limit: 10 per minute", { status: 429 });
  }

  // Load catalog (lightweight)
  const [apps, caps, risks, inits] = await Promise.all([
    db.application.findMany({
      where: { workspaceId, isActive: true },
      select: {
        id: true, name: true, vendor: true, description: true,
        lifecycle: true, rationalizationStatus: true,
        businessValue: true, technicalHealth: true,
      },
      orderBy: { updatedAt: "desc" }, take: 300,
    }),
    db.businessCapability.findMany({
      where: { workspaceId, isActive: true },
      select: { id: true, name: true, description: true, level: true },
      orderBy: { updatedAt: "desc" }, take: 300,
    }),
    db.techRisk.findMany({
      where: { workspaceId },
      select: {
        id: true, title: true, description: true,
        status: true, category: true, riskScore: true,
      },
      orderBy: { updatedAt: "desc" }, take: 300,
    }).catch(() => []),
    db.initiative.findMany({
      where: { workspaceId },
      select: {
        id: true, name: true, description: true,
        status: true, horizon: true,
      },
      orderBy: { updatedAt: "desc" }, take: 200,
    }),
  ]);

  const catalog = truncateCatalog({ applications: apps, capabilities: caps, risks, initiatives: inits });

  const orgCtx = [
    workspace.industry && `Industry: ${workspace.industry}`,
    (workspace as any).subIndustry && `Sub-industry: ${(workspace as any).subIndustry}`,
    (workspace as any).region && `Region: ${(workspace as any).region}`,
    (workspace as any).regulatoryRegime && `Regulatory: ${(workspace as any).regulatoryRegime}`,
  ].filter(Boolean).join(" | ") || "No organization profile set.";

  const userMessage = `ORGANIZATION CONTEXT: ${orgCtx}

CATALOG:
${JSON.stringify(catalog)}

USER QUERY: ${query}`;

  // Stream Anthropic response, pipe as SSE
  const encoder = new TextEncoder();

  // Classify Anthropic SDK errors into friendly categories
  function classifyError(err: any): { code: string; friendly: string; retriable: boolean } {
    const raw = typeof err?.message === "string" ? err.message : String(err ?? "");
    const status = err?.status;
    // Anthropic returns a JSON body on errors; detect common types
    if (/overloaded/i.test(raw) || status === 529) {
      return {
        code: "overloaded",
        friendly: "Claude is temporarily overloaded. Please try again in a moment.",
        retriable: true,
      };
    }
    if (status === 429 || /rate.?limit/i.test(raw)) {
      return {
        code: "rate_limited",
        friendly: "Claude is rate-limited right now — try again shortly.",
        retriable: true,
      };
    }
    if (status === 401 || status === 403) {
      return { code: "auth", friendly: "AI service is not authorized. Contact admin.", retriable: false };
    }
    if (status && status >= 500) {
      return { code: "upstream", friendly: "Claude is having issues. Please retry.", retriable: true };
    }
    return { code: "unknown", friendly: "Something went wrong. Please try again.", retriable: false };
  }

  async function runStream() {
    return client.messages.stream({
      model: MODEL,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const MAX_ATTEMPTS = 2;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const response = await runStream();
          for await (const event of response) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              send("delta", { text: event.delta.text });
            }
          }
          send("done", { promptVersion: PROMPT_VERSION });
          controller.close();
          return;
        } catch (err: any) {
          const info = classifyError(err);
          if (info.retriable && attempt < MAX_ATTEMPTS) {
            // brief backoff: 1.2s then retry once
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }
          send("error", { code: info.code, message: info.friendly });
          controller.close();
          return;
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
