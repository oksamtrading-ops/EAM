import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { rateLimit } from "@/lib/rate-limit";
import { anthropic as client } from "@/server/ai/client";
import { MODEL_SONNET, MODEL_OPUS } from "@/server/ai/models";

const CLASSIFIER_MODEL = MODEL_OPUS;
const REASONER_MODEL = MODEL_SONNET;

/** Strip markdown code-block fences (```json ... ```) from AI responses */
function stripCodeBlock(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return match ? match[1]!.trim() : trimmed;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = rateLimit(userId, { maxRequests: 6, windowMs: 60_000 });
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
    case "detect-stack":
      return detectStack(workspace, payload);
    case "eol-analysis":
      return eolAnalysis(workspace, payload);
    case "generate-reference-architecture":
      return generateReferenceArchitecture(workspace, payload);
    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
  }
}

// ─── Prompt M7-A — Detect Technology Stack ────────────────

async function detectStack(
  workspace: { clientName: string | null; name: string; industry: string | null; id: string },
  payload: { applicationId: string }
) {
  const app = await db.application.findFirst({
    where: { id: payload.applicationId, workspaceId: workspace.id, isActive: true },
    include: {
      capabilities: {
        include: { capability: { select: { name: true, level: true } } },
      },
      interfacesFrom: {
        where: { isActive: true },
        include: { targetApp: { select: { name: true } } },
      },
      interfacesTo: {
        where: { isActive: true },
        include: { sourceApp: { select: { name: true } } },
      },
      techStackLinks: {
        include: { techRadarEntry: { select: { name: true, quadrant: true, ring: true } } },
      },
      technologyComponents: {
        include: {
          component: {
            select: { id: true, name: true, product: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!app) {
    return Response.json({ error: "Application not found" }, { status: 404 });
  }

  const components = await db.technologyComponent.findMany({
    where: { workspaceId: workspace.id, isActive: true },
    include: {
      product: {
        select: {
          name: true,
          type: true,
          category: true,
          vendor: { select: { name: true } },
        },
      },
      version: { select: { version: true, lifecycleStatus: true } },
    },
    take: 200,
  });

  const existingIds = new Set(app.technologyComponents.map((l) => l.componentId));
  const candidates = components.filter((c) => !existingIds.has(c.id));

  const interfaceLines = [
    ...app.interfacesFrom.map(
      (i) => `  → ${i.targetApp.name} | ${i.protocol} | ${i.criticality}`
    ),
    ...app.interfacesTo.map(
      (i) => `  ← ${i.sourceApp.name} | ${i.protocol} | ${i.criticality}`
    ),
  ];

  const capabilityLines = app.capabilities
    .map((c) => `  - ${c.capability.name} (${c.capability.level})`)
    .join("\n");

  const radarLines = app.techStackLinks
    .map(
      (t) =>
        `  - ${t.techRadarEntry.name} (${t.techRadarEntry.quadrant}, ${t.techRadarEntry.ring})`
    )
    .join("\n");

  const componentCatalog = candidates
    .map(
      (c) =>
        `- id=${c.id} | ${c.name} | product: ${c.product.name} | vendor: ${c.product.vendor.name} | type: ${c.product.type}${c.product.category ? ` | category: ${c.product.category}` : ""} | env: ${c.environment} | host: ${c.hostingModel}${c.version ? ` | v${c.version.version} (${c.version.lifecycleStatus})` : ""}`
    )
    .join("\n");

  const existingLinks = app.technologyComponents
    .map((l) => `  - ${l.component.name} (${l.component.product.name})`)
    .join("\n");

  const prompt = `ROLE
You are a senior Enterprise Architect performing technology stack inference. Given an application's metadata, you identify which already-catalogued Technology Components it most likely depends on.

CLIENT: ${workspace.clientName || workspace.name}
INDUSTRY: ${workspace.industry ?? "Unknown"}

APPLICATION:
- Name: ${app.name}
- Description: ${app.description ?? "(none)"}
- Type: ${app.applicationType}
- Deployment: ${app.deploymentModel}
- Vendor: ${app.vendor ?? "N/A"}
- Lifecycle: ${app.lifecycle}
- Capabilities:
${capabilityLines || "  (none mapped)"}
- Interfaces:
${interfaceLines.join("\n") || "  (none documented)"}
- TechRadar entries on this app:
${radarLines || "  (none)"}
- Already-linked components (DO NOT suggest these):
${existingLinks || "  (none)"}

CANDIDATE COMPONENTS IN CATALOG (suggest ONLY from this list, by id):
${componentCatalog || "(empty catalog)"}

TASK:
Infer which catalog components this application most likely uses based on:
- Application type and deployment model (SAAS apps tend to use identity providers, monitoring; on-prem apps tend to use VMs, databases)
- Interface protocols (REST_API implies API gateways; MESSAGING implies queues)
- Capabilities supported (Analytics → data warehouse; Auth → identity provider)
- Vendor overlap (if app is from Microsoft, prefer Microsoft-vendored components)
- Industry norms

Only suggest components you are REASONABLY confident about. A shorter, higher-confidence list is better than a long speculative one. Never invent components — use only the ids provided.

OUTPUT FORMAT (JSON only, no markdown):
{
  "rationale": "string (1-2 sentences: overall inference strategy)",
  "suggestions": [
    {
      "componentId": "string (must be one of the catalog ids above)",
      "layer": "PRESENTATION | APPLICATION | DATA | INTEGRATION | INFRASTRUCTURE | SECURITY",
      "role": "PRIMARY | SECONDARY | FALLBACK | DEPRECATED",
      "criticality": "CRITICAL | IMPORTANT | STANDARD | OPTIONAL",
      "confidence": "HIGH | MEDIUM | LOW",
      "rationale": "string (1 sentence)"
    }
  ]
}`;

  const message = await client.messages.create({
    model: REASONER_MODEL,
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const text = (message.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(stripCodeBlock(text)) as {
      rationale?: string;
      suggestions?: Array<{ componentId: string }>;
    };
    const validIds = new Set(candidates.map((c) => c.id));
    const enriched = (parsed.suggestions ?? [])
      .filter((s) => validIds.has(s.componentId))
      .map((s) => {
        const comp = candidates.find((c) => c.id === s.componentId)!;
        return {
          ...s,
          componentName: comp.name,
          productName: comp.product.name,
          vendorName: comp.product.vendor.name,
        };
      });
    return Response.json({ rationale: parsed.rationale ?? "", suggestions: enriched });
  } catch {
    return Response.json(
      { rationale: "", suggestions: [], error: "Failed to parse AI response" },
      { status: 200 }
    );
  }
}

// ─── Prompt M7-B — EOL Risk Analysis Narrative ────────────

async function eolAnalysis(
  workspace: { clientName: string | null; name: string; industry: string | null; id: string },
  _payload: unknown
) {
  const now = new Date();
  const in180 = new Date();
  in180.setDate(in180.getDate() + 180);

  const riskyComponents = await db.technologyComponent.findMany({
    where: {
      workspaceId: workspace.id,
      isActive: true,
      OR: [
        { version: { endOfLifeDate: { lte: in180 } } },
        { version: { lifecycleStatus: { in: ["END_OF_LIFE", "DEPRECATED"] } } },
      ],
    },
    include: {
      product: { select: { name: true, vendor: { select: { name: true } } } },
      version: { select: { version: true, lifecycleStatus: true, endOfLifeDate: true } },
      applications: { select: { applicationId: true } },
    },
    take: 80,
  });

  if (riskyComponents.length === 0) {
    return Response.json({
      executiveSummary: "No components are currently at end-of-life risk within the next 180 days.",
      perComponent: [],
      portfolioRisks: [],
    });
  }

  const componentList = riskyComponents
    .map((c) => {
      const eol = c.version?.endOfLifeDate
        ? `EOL: ${c.version.endOfLifeDate.toISOString().slice(0, 10)}`
        : "EOL: unknown";
      const status = c.version?.lifecycleStatus ?? "UNKNOWN";
      return `- ${c.name} (${c.product.name} ${c.version?.version ?? "?"}, vendor: ${c.product.vendor.name}) | Status: ${status} | ${eol} | Apps impacted: ${c.applications.length}`;
    })
    .join("\n");

  const prompt = `ROLE
You are a senior Technology Risk Advisor preparing a briefing on end-of-life technology exposure for a client's architecture review board.

CLIENT: ${workspace.clientName || workspace.name}
INDUSTRY: ${workspace.industry ?? "Unknown"}
TODAY: ${now.toISOString().slice(0, 10)}

COMPONENTS WITH EOL RISK (past EOL, within 180 days, or deprecated/EOL status):
${componentList}

TASK:
Produce an EOL risk analysis. Return strict JSON.

OUTPUT FORMAT (JSON only, no markdown):
{
  "executiveSummary": "string (3-5 sentences: overall EOL posture, urgency level, top concentration risks, recommended cadence)",
  "perComponent": [
    {
      "componentName": "string (must match one from the list above)",
      "urgency": "CRITICAL | HIGH | MEDIUM | LOW",
      "recommendation": "string (1-2 sentences: specific action — upgrade, migrate, extended support, replace)",
      "replacementOptions": ["string (1-3 concrete product/vendor options appropriate to this industry)"],
      "timeline": "string (e.g. '0-30 days', '30-90 days', '3-6 months')"
    }
  ],
  "portfolioRisks": [
    "string — each sentence is a cross-cutting risk (vendor concentration, cascading upgrades, migration capacity)"
  ]
}`;

  const message = await client.messages.create({
    model: REASONER_MODEL,
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const text = (message.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(stripCodeBlock(text));
    return Response.json(parsed);
  } catch {
    return Response.json(
      {
        executiveSummary: "EOL analysis unavailable.",
        perComponent: [],
        portfolioRisks: [],
        error: "Failed to parse AI response",
      },
      { status: 200 }
    );
  }
}

// ─── Prompt M7-C — Generate Reference Architecture ────────

async function generateReferenceArchitecture(
  workspace: { clientName: string | null; name: string; industry: string | null; id: string },
  payload: { category: string; notes?: string }
) {
  if (!payload.category || typeof payload.category !== "string") {
    return Response.json({ error: "category is required" }, { status: 400 });
  }

  const products = await db.technologyProduct.findMany({
    where: { workspaceId: workspace.id, isActive: true },
    select: {
      id: true,
      name: true,
      type: true,
      category: true,
      description: true,
      vendor: { select: { name: true } },
    },
    take: 200,
  });

  const standards = await db.technologyStandard.findMany({
    where: { workspaceId: workspace.id, isActive: true, status: "ACTIVE" },
    select: {
      name: true,
      level: true,
      category: true,
      product: { select: { name: true } },
    },
    take: 50,
  });

  const productCatalog = products
    .map(
      (p) =>
        `- id=${p.id} | ${p.name} | vendor: ${p.vendor.name} | type: ${p.type}${p.category ? ` | category: ${p.category}` : ""}`
    )
    .join("\n");

  const standardsList = standards
    .map(
      (s) =>
        `- ${s.name} [${s.level}] ${s.product ? `→ ${s.product.name}` : ""}${s.category ? ` (${s.category})` : ""}`
    )
    .join("\n");

  const prompt = `ROLE
You are a senior Enterprise Architect designing reference architectures. Given a target category (e.g. "Web App", "Data Pipeline", "Event-Driven Microservices") and the client's existing product catalog, you propose a layered reference architecture using ONLY products from the catalog.

CLIENT: ${workspace.clientName || workspace.name}
INDUSTRY: ${workspace.industry ?? "Unknown"}
CATEGORY: ${payload.category}
ADDITIONAL NOTES: ${payload.notes ?? "(none)"}

PRODUCT CATALOG (use ONLY these ids):
${productCatalog || "(empty catalog)"}

ACTIVE TECHNOLOGY STANDARDS (respect these — MANDATORY products must be preferred; PROHIBITED products must NOT appear):
${standardsList || "(none)"}

LAYER DEFINITIONS:
- PRESENTATION: UI, frontend frameworks, mobile clients
- APPLICATION: business logic runtime, app servers, frameworks
- DATA: databases, caches, data warehouses, object storage
- INTEGRATION: API gateways, message queues, ETL, iPaaS
- INFRASTRUCTURE: compute, OS, container runtime, cloud platform
- SECURITY: IAM, secrets, WAF, encryption

ROLE DEFINITIONS:
- PRIMARY: the preferred choice
- SECONDARY: supporting or alternative option
- FALLBACK: only when primary is unavailable
- DEPRECATED: legacy, do not use for new work

TASK:
Produce a reference architecture blueprint. Pick the most appropriate product from the catalog for each needed layer. Skip layers that are not applicable to this category. Provide rationale for each choice.

RULES:
- Every suggested component must reference an id from the catalog. Never invent products.
- Prefer products that align with active MANDATORY/RECOMMENDED standards.
- Exclude any products flagged PROHIBITED in standards.
- Keep the component set tight — 4 to 10 components is typical for a focused reference architecture.

OUTPUT FORMAT (JSON only, no markdown):
{
  "name": "string (e.g. 'Modern Web App Reference Architecture')",
  "description": "string (2-4 sentences: what this reference covers, when to use it)",
  "components": [
    {
      "productId": "string (must be an id from the catalog)",
      "layer": "PRESENTATION | APPLICATION | DATA | INTEGRATION | INFRASTRUCTURE | SECURITY",
      "role": "PRIMARY | SECONDARY | FALLBACK | DEPRECATED",
      "rationale": "string (1 sentence)"
    }
  ],
  "notes": "string (2-3 sentences: adoption guidance, known gaps, standards alignment)"
}`;

  const message = await client.messages.create({
    model: REASONER_MODEL,
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const text = (message.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(stripCodeBlock(text)) as {
      name?: string;
      description?: string;
      notes?: string;
      components?: Array<{ productId: string; layer: string; role: string; rationale: string }>;
    };
    const validIds = new Set(products.map((p) => p.id));
    const enriched = (parsed.components ?? [])
      .filter((c) => validIds.has(c.productId))
      .map((c) => {
        const p = products.find((pp) => pp.id === c.productId)!;
        return {
          ...c,
          productName: p.name,
          vendorName: p.vendor.name,
        };
      });
    return Response.json({
      name: parsed.name ?? `${payload.category} Reference Architecture`,
      description: parsed.description ?? "",
      notes: parsed.notes ?? "",
      components: enriched,
    });
  } catch {
    return Response.json(
      {
        name: "",
        description: "",
        notes: "",
        components: [],
        error: "Failed to parse AI response",
      },
      { status: 200 }
    );
  }
}
