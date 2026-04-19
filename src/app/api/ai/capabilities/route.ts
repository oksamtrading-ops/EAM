import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { rateLimit } from "@/lib/rate-limit";
import { anthropic as client } from "@/server/ai/client";
import { MODEL_SONNET } from "@/server/ai/models";

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
    model: MODEL_SONNET,
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

  const assessedCount = payload.capabilities.filter(
    (c) => c.currentMaturity !== "NOT_ASSESSED"
  ).length;
  const totalCount = payload.capabilities.length;

  const prompt = `ROLE
You are a senior Enterprise Architect with deep expertise in capability maturity assessment, trained on industry-standard reference frameworks including:
- APQC Process Classification Framework (PCF) — cross-industry and industry-specific
- BIAN (Banking), eTOM (Telecom), ACORD (Insurance), SCOR (Supply Chain), ITIL/COBIT (IT), HL7/HIMSS (Healthcare), or the relevant industry equivalent
- TOGAF and Business Architecture Guild (BIZBOK) capability modeling standards
- CMM/CMMI maturity model methodology

OBJECTIVE
Produce a comprehensive, structured gap analysis of ALL capability maturity gaps for the client. Every capability with a gap between current and target maturity MUST be included, categorized by severity, and accompanied by actionable analysis. Do NOT limit to a fixed number of gaps — report all of them.

INPUTS
- Client: ${workspace.clientName || workspace.name}
- Industry: ${workspace.industry}
- Assessment coverage: ${assessedCount} of ${totalCount} capabilities assessed
- Maturity scale: INITIAL (1) → DEVELOPING (2) → DEFINED (3) → MANAGED (4) → OPTIMIZING (5)
- Capability assessment data:
${capabilityList}

METHOD (follow in order)
1. Identify the reference framework(s) most applicable to this industry. Name them explicitly.
2. For each capability, compute the maturity gap (target − current). Use numeric mapping: INITIAL=1, DEVELOPING=2, DEFINED=3, MANAGED=4, OPTIMIZING=5. NOT_ASSESSED = null (exclude from gap calculations but flag separately).
3. Classify each gap using a composite score of (gap size × strategic importance weight). Importance weights: CRITICAL=4, HIGH=3, MEDIUM=2, LOW=1, NOT_ASSESSED=0.
   - CRITICAL_GAP: composite score ≥ 9, or any CRITICAL importance capability with gap ≥ 2
   - HIGH_GAP: composite score 6–8, or any HIGH importance capability with gap ≥ 2
   - MODERATE_GAP: composite score 3–5
   - LOW_GAP: composite score 1–2
4. Identify strengths: capabilities at MANAGED or OPTIMIZING with no gap or gap ≤ 0.
5. Flag all NOT_ASSESSED capabilities as a data quality concern.
6. Derive transformation themes by clustering related gaps into strategic initiatives.

CONSTRAINTS
- Report ALL gaps, not just the top N. Every capability with gap > 0 must appear.
- Do NOT invent data. Work strictly from the assessment data provided.
- Do NOT cite frameworks you are not confident exist.
- Strengths are only capabilities where current maturity ≥ target maturity OR current is MANAGED/OPTIMIZING.
- Transformation themes must reference specific capabilities from the gaps list.

OUTPUT FORMAT (JSON only, no markdown, no explanation):
{
  "referenceFrameworks": ["string — name of each framework used"],
  "executiveSummary": "string (3-5 sentences: overall maturity posture, key risk areas, data quality note if many NOT_ASSESSED)",
  "maturityDistribution": {
    "INITIAL": 0,
    "DEVELOPING": 0,
    "DEFINED": 0,
    "MANAGED": 0,
    "OPTIMIZING": 0,
    "NOT_ASSESSED": 0
  },
  "gaps": [
    {
      "capabilityName": "string",
      "level": "L1 | L2 | L3",
      "category": "CRITICAL_GAP | HIGH_GAP | MODERATE_GAP | LOW_GAP",
      "currentMaturity": "string",
      "targetMaturity": "string",
      "gapSize": 0,
      "strategicImportance": "string",
      "analysis": "string (2-3 sentences: why this gap matters, business risk, industry context)",
      "recommendation": "string (1-2 sentences: specific remediation action)"
    }
  ],
  "strengths": [
    {
      "capabilityName": "string",
      "level": "string",
      "currentMaturity": "string",
      "note": "string (1 sentence: why this is a strength, how to leverage it)"
    }
  ],
  "notAssessed": ["string — names of capabilities with NOT_ASSESSED maturity"],
  "transformationThemes": [
    {
      "theme": "string (short name, e.g. 'Digital Operations Modernization')",
      "description": "string (2-3 sentences: what this initiative addresses and expected outcome)",
      "relatedCapabilities": ["string — capability names from gaps list"]
    }
  ]
}`;

  const message = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const text = (message.content[0] as any).text;
    const parsed = JSON.parse(stripCodeBlock(text));
    return Response.json(parsed);
  } catch {
    return Response.json(
      { gaps: [], error: "Failed to parse AI response" },
      { status: 200 }
    );
  }
}

async function generateInvestmentPriorities(
  workspace: any,
  payload: {
    budget: "CONSTRAINED" | "MODERATE" | "EXPANSIVE";
    timeHorizon: "6_MONTHS" | "1_YEAR" | "2_YEARS" | "3_PLUS_YEARS";
    capabilities: Array<{
      name: string;
      level?: string;
      strategicImportance: string;
      currentMaturity: string;
      targetMaturity: string;
    }>;
  }
) {
  const assessedCount = payload.capabilities.filter(
    (c) => c.currentMaturity !== "NOT_ASSESSED"
  ).length;
  const totalCount = payload.capabilities.length;

  const capabilityList = payload.capabilities
    .map(
      (c) =>
        `- ${c.name} (${c.level ?? "?"}) | Importance: ${c.strategicImportance} | Current: ${c.currentMaturity} → Target: ${c.targetMaturity}`
    )
    .join("\n");

  const prompt = `ROLE
You are a senior Enterprise Architect and Technology Investment Advisor with deep expertise in capability-based planning, trained on industry-standard frameworks including:
- APQC Process Classification Framework (PCF) — cross-industry and industry-specific
- BIAN (Banking), eTOM (Telecom), ACORD (Insurance), SCOR (Supply Chain), ITIL/COBIT (IT), HL7/HIMSS (Healthcare), or the relevant industry equivalent
- TOGAF Architecture Development Method (ADM) — Phase E (Opportunities & Solutions) and Phase F (Migration Planning)
- BIZBOK capability-based investment planning
- CMM/CMMI maturity progression models

OBJECTIVE
Produce a comprehensive, structured investment prioritization roadmap that sequences capability maturity improvements based on strategic value, interdependencies, budget constraints, and implementation feasibility. Every capability with a maturity gap MUST be addressed — either as a funded initiative or explicitly deferred with rationale.

INPUTS
- Client: ${workspace.clientName || workspace.name}
- Industry: ${workspace.industry}
- Investment budget: ${payload.budget}
- Planning horizon: ${payload.timeHorizon.replace(/_/g, " ")}
- Assessment coverage: ${assessedCount} of ${totalCount} capabilities assessed
- Maturity scale: INITIAL (1) → DEVELOPING (2) → DEFINED (3) → MANAGED (4) → OPTIMIZING (5)
- Capability assessment data:
${capabilityList}

METHOD (follow in order)
1. Identify the reference framework(s) most applicable to this industry. Name them explicitly.
2. For each capability, compute the maturity gap (target − current) using numeric mapping: INITIAL=1, DEVELOPING=2, DEFINED=3, MANAGED=4, OPTIMIZING=5. NOT_ASSESSED = null (exclude from scoring but flag separately).
3. Compute a priority score using: (importance weight × gap size) + dependency bonus.
   - Importance weights: CRITICAL=4, HIGH=3, MEDIUM=2, LOW=1, NOT_ASSESSED=0
   - Dependency bonus: +1 if the capability is a prerequisite for 2+ other gap capabilities
4. Apply budget filter:
   - CONSTRAINED: Fund only CRITICAL and HIGH importance gaps; defer the rest with rationale
   - MODERATE: Fund CRITICAL, HIGH, and MEDIUM importance gaps; defer LOW
   - EXPANSIVE: Fund all gaps
5. Sequence funded initiatives into waves based on:
   - Dependencies (prerequisites first)
   - Quick wins (high value, low effort) in early waves
   - Foundation capabilities (data, governance, security) before domain-specific capabilities
   - Planning horizon constraints (shorter horizons = fewer waves)
6. For each initiative, assess implementation approach and estimated effort based on the gap size and capability complexity.
7. Identify capabilities that are NOT_ASSESSED as a data quality concern — they cannot be prioritized until assessed.

CONSTRAINTS
- Address ALL capabilities with a gap — either as a funded initiative or an explicitly deferred item.
- Do NOT invent data. Work strictly from the assessment data provided.
- Do NOT cite frameworks you are not confident exist.
- Dependencies must reference specific capabilities from the input data, not generic concepts.
- Wave timelines must fit within the stated planning horizon.
- Each initiative's rationale must connect to business outcomes, not just maturity scores.

OUTPUT FORMAT (JSON only, no markdown, no explanation):
{
  "referenceFrameworks": ["string — name of each framework used"],
  "executiveSummary": "string (4-6 sentences: overall investment posture, total gaps to address, budget fit assessment, key themes, and expected outcome if roadmap is executed)",
  "totalInvestmentGaps": 0,
  "fundedCount": 0,
  "deferredCount": 0,
  "waves": [
    {
      "wave": 1,
      "name": "string (e.g. 'Foundation & Quick Wins')",
      "timeline": "string (e.g. 'Q1–Q2 2026')",
      "theme": "string (1 sentence: what this wave achieves)",
      "initiatives": [
        {
          "priority": 1,
          "capabilityName": "string",
          "level": "string",
          "currentMaturity": "string",
          "targetMaturity": "string",
          "gapSize": 0,
          "strategicImportance": "string",
          "investmentRationale": "string (2-3 sentences: why invest now, business risk of delay, expected business outcome)",
          "implementationApproach": "string (1-2 sentences: how to close the gap — e.g. process redesign, technology platform, hire expertise, partner engagement)",
          "estimatedEffort": "LOW | MEDIUM | HIGH",
          "riskIfDeferred": "string (1 sentence: what happens if this is not funded)",
          "dependencies": ["string — other capability names that must be addressed first or in parallel"]
        }
      ]
    }
  ],
  "deferred": [
    {
      "capabilityName": "string",
      "level": "string",
      "strategicImportance": "string",
      "gapSize": 0,
      "deferralReason": "string (1-2 sentences: why deferred — budget constraint, low priority, dependency on funded items, etc.)",
      "prerequisiteWave": "string | null (e.g. 'Wave 1' if this should follow a funded wave)"
    }
  ],
  "notAssessed": ["string — capability names excluded due to missing assessment data"],
  "budgetGuidance": "string (2-3 sentences: whether the budget level is adequate for the gap profile, what trade-offs were made, and what additional funding would unlock)"
}`;

  const message = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const text = (message.content[0] as any).text;
    const parsed = JSON.parse(stripCodeBlock(text));
    return Response.json(parsed);
  } catch {
    return Response.json(
      { waves: [], error: "Failed to parse AI response" },
      { status: 200 }
    );
  }
}
