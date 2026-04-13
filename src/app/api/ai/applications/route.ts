import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { rateLimit } from "@/lib/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = rateLimit(userId, { maxRequests: 10, windowMs: 60_000 });
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
    case "rationalization":
      return generateRationalization(workspace, payload);
    case "impact-analysis":
      return generateImpactAnalysis(workspace, payload);
    case "tech-recommendations":
      return generateTechRecommendations(workspace, payload);
    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
  }
}

/** Strip markdown code-block fences (```json ... ```) from AI responses */
function stripCodeBlock(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return match ? match[1]!.trim() : trimmed;
}

// ─── Rationalization Analysis ────────────────────────────

async function generateRationalization(workspace: any, payload: { apps: any[] }) {
  const appList = payload.apps
    .map(
      (a) =>
        `- ${a.name} | Vendor: ${a.vendor ?? "N/A"} | Type: ${a.applicationType ?? "N/A"} | Deployment: ${a.deploymentModel ?? "N/A"} | Lifecycle: ${a.lifecycle} | BV: ${a.businessValue} | TH: ${a.technicalHealth} | Rationalization: ${a.rationalizationStatus} | Cost: ${a.annualCostUsd ? "$" + Number(a.annualCostUsd).toLocaleString() : "N/A"} | CostModel: ${a.costModel ?? "N/A"} | Capabilities: ${a.capabilityCount}`
    )
    .join("\n");

  const totalCost = payload.apps.reduce((sum, a) => sum + (Number(a.annualCostUsd) || 0), 0);

  const prompt = `ROLE
You are a senior Enterprise Architect specializing in application portfolio rationalization, trained on industry-standard frameworks including:
- Gartner TIME Model (Tolerate, Invest, Migrate, Eliminate)
- TOGAF Application Portfolio Management (Phase B/C/E)
- Forrester Application Rationalization methodology
- APQC Application Lifecycle Management benchmarks

IMPORTANT: Conduct deep research and analysis before making any recommendation. Every recommendation must be grounded in the data provided, with clear reasoning tied to the scoring methodology below.

OBJECTIVE
Produce a comprehensive, structured rationalization analysis of the ENTIRE application portfolio. Every application MUST be assessed and assigned a rationalization recommendation with business justification. Do NOT limit to a fixed number — report all applications.

INPUTS
- Client: ${workspace.clientName || workspace.name}
- Industry: ${workspace.industry}
- Portfolio size: ${payload.apps.length} applications
- Total annual IT spend: $${totalCost.toLocaleString()}
- Application portfolio data:
${appList}

METHOD (follow in order)
1. Identify the reference framework(s) most applicable. Name them explicitly.
2. For each application, compute a rationalization score using:
   - Business Value weight: CRITICAL=5, HIGH=4, MEDIUM=3, LOW=2, BV_UNKNOWN=0
   - Technical Health weight: EXCELLENT=5, GOOD=4, FAIR=3, POOR=2, TH_CRITICAL=1, TH_UNKNOWN=0
   - Lifecycle penalty: PHASING_OUT=-2, RETIRED=-4, SUNSET=-3, PLANNED=0, ACTIVE=0
   - Composite score = (BV_weight + TH_weight + lifecycle_penalty)
3. Map each application to a TIME recommendation:
   - TOLERATE (score 4-6): Adequate, no action needed, monitor only
   - INVEST (score 7+): High-value, healthy — invest to maximize returns
   - MIGRATE (score 3-5 with TH ≤ FAIR): Business value exists but tech is failing
   - ELIMINATE (score ≤ 3, or RETIRED/SUNSET lifecycle): Remove from portfolio
   Additionally flag CONSOLIDATE for apps where 2+ serve the same capabilities.
4. Identify redundancies: capabilities supported by 2+ applications.
5. Quantify savings: sum annualCostUsd for ELIMINATE + estimated savings from CONSOLIDATE (use 40-60% of the lower-cost app as estimate).
6. Flag applications with BV_UNKNOWN or TH_UNKNOWN as requiring assessment.

CONSTRAINTS
- Assess ALL applications. Every app must appear in exactly one category.
- Do NOT invent cost data. Use only what is provided.
- Do NOT cite frameworks you are not confident exist.
- Consolidation must reference specific app pairs and the shared capabilities.
- Savings estimates must be conservative and clearly labeled as estimates.
- Every recommendation must include a confidence level based on data completeness.

OUTPUT FORMAT (JSON only, no markdown, no explanation):
{
  "referenceFrameworks": ["string"],
  "executiveSummary": "string (4-8 sentences: portfolio health, key findings, total potential savings, urgent actions, data quality notes)",
  "portfolioStats": {
    "totalApps": 0,
    "totalAnnualCost": 0,
    "invest": 0,
    "tolerate": 0,
    "migrate": 0,
    "eliminate": 0,
    "consolidate": 0,
    "unassessed": 0
  },
  "estimatedAnnualSavings": 0,
  "recommendations": [
    {
      "applicationName": "string",
      "vendor": "string | null",
      "timeCategory": "INVEST | TOLERATE | MIGRATE | ELIMINATE | CONSOLIDATE",
      "currentStatus": "string",
      "businessValue": "string",
      "technicalHealth": "string",
      "annualCost": 0,
      "confidence": "HIGH | MEDIUM | LOW",
      "rationale": "string (2-3 sentences: why this recommendation, business risk, and expected outcome)",
      "action": "string (1-2 sentences: specific next step)",
      "savingsIfActioned": 0
    }
  ],
  "redundancies": [
    {
      "capabilityName": "string",
      "applications": ["string"],
      "recommendation": "string (1-2 sentences: which to keep, which to consolidate)"
    }
  ],
  "requiresAssessment": ["string — app names with UNKNOWN scores"],
  "lifecycleRisks": [
    {
      "applicationName": "string",
      "risk": "string (1 sentence)"
    }
  ],
  "assumptions": ["string — each assumption made during the analysis"],
  "dataQualityNotes": ["string — issues with input data completeness (e.g. 'X of Y apps have no cost data')"]
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const text = (message.content[0] as any).text;
    return Response.json(JSON.parse(stripCodeBlock(text)));
  } catch {
    return Response.json({ recommendations: [], error: "Failed to parse AI response" }, { status: 200 });
  }
}

// ─── Impact Analysis ─────────────────────────────────────

async function generateImpactAnalysis(
  workspace: any,
  payload: { targetApp: any; allApps: any[] }
) {
  const target = payload.targetApp;
  const targetCaps = (target.capabilities ?? [])
    .map((c: any) => `  - ${c.capabilityName} (${c.level}) | Importance: ${c.strategicImportance} | Support: ${c.supportType}`)
    .join("\n");

  const portfolioList = payload.allApps
    .filter((a) => a.id !== target.id)
    .map(
      (a) =>
        `- ${a.name} | Vendor: ${a.vendor ?? "N/A"} | Type: ${a.applicationType} | Lifecycle: ${a.lifecycle} | BV: ${a.businessValue} | TH: ${a.technicalHealth} | Capabilities: [${(a.capabilities ?? []).map((c: any) => c.capabilityName).join(", ")}]`
    )
    .join("\n");

  const prompt = `ROLE
You are a senior Enterprise Architect specializing in application dependency analysis and decommission planning, trained on:
- TOGAF Architecture Development Method — Phase E (Opportunities & Solutions)
- IT4IT Reference Architecture — application lifecycle management
- APQC Application Decommission and Migration best practices

IMPORTANT: Conduct deep research and analysis of all capability dependencies before making any recommendation. Cross-reference the target application's capabilities against the entire portfolio to identify coverage gaps and alternatives.

OBJECTIVE
Analyze the impact of retiring or replacing a specific application. Produce a structured impact assessment that identifies every capability affected, downstream risks, migration considerations, and a recommended transition plan.

INPUTS
- Client: ${workspace.clientName || workspace.name}
- Industry: ${workspace.industry}
- Target application:
  Name: ${target.name}
  Vendor: ${target.vendor ?? "N/A"}
  Type: ${target.applicationType} | Deployment: ${target.deploymentModel}
  Lifecycle: ${target.lifecycle}
  Business Value: ${target.businessValue} | Tech Health: ${target.technicalHealth}
  Annual Cost: ${target.annualCostUsd ? "$" + Number(target.annualCostUsd).toLocaleString() : "N/A"}
  Licensed Users: ${target.licensedUsers ?? "N/A"}
  Cost Model: ${target.costModel ?? "N/A"}
  Capabilities supported:
${targetCaps || "  (none mapped)"}
- Remaining portfolio (for identifying alternatives):
${portfolioList || "  (no other applications)"}

METHOD (follow in order)
1. Identify every capability that depends on the target application.
2. For each affected capability, assess the coverage risk:
   - CRITICAL_RISK: Capability is CRITICAL/HIGH importance with NO other application supporting it
   - HIGH_RISK: Capability is CRITICAL/HIGH importance with only 1 other app (single point of failure)
   - MODERATE_RISK: Capability has 2+ alternative apps OR is MEDIUM importance
   - LOW_RISK: Capability is LOW importance or has 3+ alternatives
3. Identify alternative applications already in the portfolio that could absorb each affected capability.
4. Flag capabilities that would become completely unsupported.
5. Estimate cost impact: savings from retirement vs migration/transition costs.
6. Produce a phased transition plan if retirement is recommended.

CONSTRAINTS
- Only analyze the specific target application provided.
- Alternatives must be existing applications from the portfolio, not external suggestions.
- Do NOT recommend retirement if it would leave CRITICAL capabilities unsupported without a clear alternative.
- User count and cost model should inform transition complexity.
- Be explicit about what you DON'T know (unknowns array).
- Every assessment must include a confidence level.

OUTPUT FORMAT (JSON only, no markdown, no explanation):
{
  "referenceFrameworks": ["string"],
  "targetApplication": "string",
  "overallRiskLevel": "CRITICAL | HIGH | MODERATE | LOW",
  "overallConfidence": "HIGH | MEDIUM | LOW",
  "executiveSummary": "string (4-8 sentences: can this app be safely retired, what's at stake, key risks, recommended path forward, data quality caveats)",
  "affectedCapabilities": [
    {
      "capabilityName": "string",
      "level": "string",
      "strategicImportance": "string",
      "riskLevel": "CRITICAL_RISK | HIGH_RISK | MODERATE_RISK | LOW_RISK",
      "alternativeApps": ["string"],
      "coverageAfterRetirement": "FULLY_COVERED | PARTIALLY_COVERED | UNCOVERED",
      "riskNote": "string (1 sentence)"
    }
  ],
  "uncoveredCapabilities": ["string"],
  "migrationConsiderations": [
    {
      "factor": "string (e.g. 'Data Migration', 'User Retraining', 'Integration Rewiring')",
      "complexity": "LOW | MEDIUM | HIGH",
      "description": "string (1-2 sentences)"
    }
  ],
  "costImpact": {
    "annualSavings": 0,
    "estimatedTransitionCost": "string (e.g. 'LOW: < $50K')",
    "paybackPeriod": "string (e.g. '6-12 months')",
    "netAssessment": "string (1-2 sentences)"
  },
  "recommendation": "RETIRE | MIGRATE | KEEP | CONSOLIDATE",
  "transitionPlan": [
    {
      "phase": 1,
      "name": "string",
      "timeline": "string (e.g. 'Weeks 1-4')",
      "actions": ["string"],
      "risks": ["string"]
    }
  ],
  "assumptions": ["string — each assumption made"],
  "unknowns": ["string — factors that could not be assessed from available data"],
  "dataQualityNotes": ["string — issues with input data"]
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const text = (message.content[0] as any).text;
    return Response.json(JSON.parse(stripCodeBlock(text)));
  } catch {
    return Response.json({ affectedCapabilities: [], error: "Failed to parse AI response" }, { status: 200 });
  }
}

// ─── Technology Recommendations ──────────────────────────

async function generateTechRecommendations(
  workspace: any,
  payload: { capabilities: any[]; stackProfile: any; budgetPosture: string }
) {
  const capList = payload.capabilities
    .map((c) => {
      const apps = (c.currentApps ?? [])
        .map(
          (a: any) =>
            `${a.name} (${a.vendor ?? "N/A"}, ${a.applicationType}, ${a.deploymentModel}, TH:${a.technicalHealth}, BV:${a.businessValue}, $${Number(a.annualCostUsd || 0).toLocaleString()}/yr)`
        )
        .join("; ");
      return `- ${c.name} (${c.level}) | Importance: ${c.strategicImportance} | Maturity: ${c.currentMaturity} → ${c.targetMaturity} | Apps: [${apps || "NONE"}]`;
    })
    .join("\n");

  const vendorSummary = Object.entries(payload.stackProfile?.vendorCounts ?? {})
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([vendor, count]) => `${vendor}: ${count} apps`)
    .join(", ");

  const prompt = `ROLE
You are a senior Enterprise Architect and Technology Advisory specialist with deep expertise in vendor selection and technology-capability alignment, trained on:
- TOGAF Technology Reference Model (TRM) and Standards Information Base (SIB)
- Gartner Magic Quadrant positioning and market analysis methodology
- Forrester Wave evaluation criteria
- APQC technology benchmarking
- Industry-specific technology landscapes (BIAN for Banking, eTOM/TM Forum for Telecom, HL7/HIMSS for Healthcare, etc.)

IMPORTANT: Conduct deep research on each capability's technology landscape before making recommendations. Cross-reference the client's existing vendor ecosystem, deployment preferences, and industry context. Every recommendation must be specific, justified, and grounded in real commercially available products.

OBJECTIVE
For each business capability, recommend technology solutions that best fit the client's context. For capabilities already supported by an application, evaluate whether the current solution is adequate or should be replaced. For capabilities with no application, recommend vendors to fill the gap. Recommendations must account for the existing tech stack to minimize vendor sprawl and maximize integration synergies.

INPUTS
- Client: ${workspace.clientName || workspace.name}
- Industry: ${workspace.industry}
- Budget posture: ${payload.budgetPosture}
- Existing vendor ecosystem: ${vendorSummary || "No vendors catalogued"}
- Dominant deployment model: ${payload.stackProfile?.dominantDeployment ?? "Unknown"}
- Application types in portfolio: ${JSON.stringify(payload.stackProfile?.typeCounts ?? {})}
- Capabilities to analyze:
${capList}

METHOD (follow in order)
1. Identify the reference framework(s) and industry technology landscape applicable. Name them explicitly.
2. For each capability, classify the current technology coverage:
   - WELL_SERVED: App exists with businessValue ≥ HIGH and technicalHealth ≥ GOOD and lifecycle = ACTIVE
   - UNDERSERVED: App exists but technicalHealth ≤ FAIR, or lifecycle = PHASING_OUT, or businessValue = LOW
   - UNSERVED: No application mapped to this capability
3. For UNDERSERVED and UNSERVED capabilities, recommend 2-3 technology solutions ranked by fit. Consider:
   - Existing vendor ecosystem (prefer extending current vendors over introducing new ones)
   - Deployment model consistency (match client's dominant model)
   - Industry appropriateness (recommend solutions proven in this industry)
   - Integration potential with existing stack
   - Cost tier relative to budget posture
4. For WELL_SERVED capabilities, note the current solution is adequate and optionally flag optimization opportunities.
5. Identify platform consolidation opportunities where one vendor platform could serve multiple underserved/unserved capabilities.

CONSTRAINTS
- Only recommend real, commercially available technology products/vendors that you are confident exist. Include the vendor name AND product name.
- Do NOT hallucinate products. If you are not confident a specific product exists, say "a solution in the {category} space" instead of naming a fake product.
- Prefer extending the client's existing vendor relationships before introducing new vendors.
- Cost tier estimates must be clearly labeled as market-range approximations, not quotes: LOW (<$50K/yr), MEDIUM ($50K-200K/yr), HIGH ($200K-500K/yr), ENTERPRISE (>$500K/yr).
- Do NOT recommend specific pricing.
- For each recommendation, explain WHY this solution fits THIS client (not generic vendor marketing).
- Every recommendation must include a confidence level.

OUTPUT FORMAT (JSON only, no markdown, no explanation):
{
  "referenceFrameworks": ["string"],
  "executiveSummary": "string (4-8 sentences: coverage assessment, key gaps, vendor ecosystem health, consolidation opportunities, and top recommendation themes)",
  "stackProfile": {
    "dominantVendors": ["string"],
    "dominantDeployment": "string",
    "vendorCount": 0,
    "consolidationOpportunity": "string (1-2 sentences)"
  },
  "capabilities": [
    {
      "capabilityName": "string",
      "level": "string",
      "strategicImportance": "string",
      "coverageStatus": "WELL_SERVED | UNDERSERVED | UNSERVED",
      "currentApp": {
        "name": "string | null",
        "vendor": "string | null",
        "technicalHealth": "string | null",
        "assessment": "string | null (1 sentence: why adequate/inadequate)"
      },
      "recommendations": [
        {
          "rank": 1,
          "vendorName": "string",
          "productName": "string",
          "category": "string (e.g. 'ERP', 'CRM', 'iPaaS', 'BPM', 'GRC')",
          "confidence": "HIGH | MEDIUM | LOW",
          "fitRationale": "string (2-3 sentences: why this solution for THIS client)",
          "costTier": "LOW | MEDIUM | HIGH | ENTERPRISE",
          "deploymentModel": "string",
          "integrationNotes": "string (1 sentence: how it connects to existing stack)",
          "existingVendorExtension": true
        }
      ]
    }
  ],
  "platformConsolidation": [
    {
      "vendorPlatform": "string",
      "capabilitiesServed": ["string"],
      "rationale": "string (2-3 sentences)",
      "estimatedCostTier": "string"
    }
  ],
  "assumptions": ["string — each assumption made"],
  "dataQualityNotes": ["string — issues with input data completeness"]
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const text = (message.content[0] as any).text;
    return Response.json(JSON.parse(stripCodeBlock(text)));
  } catch {
    return Response.json({ capabilities: [], error: "Failed to parse AI response" }, { status: 200 });
  }
}
