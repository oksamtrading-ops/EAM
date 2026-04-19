import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { rateLimit } from "@/lib/rate-limit";
import { anthropic as client } from "@/server/ai/client";
import { MODEL_SONNET } from "@/server/ai/models";

const MODEL = MODEL_SONNET;

function stripCodeBlock(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return match ? match[1]!.trim() : trimmed;
}

function fmtCost(n: number): string {
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(0)}K`
      : `$${n.toLocaleString()}`;
}

function fmtDist(d: Record<string, number>): string {
  return Object.entries(d)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
    .join(", ");
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = rateLimit(userId, { maxRequests: 3, windowMs: 120_000 });
  if (!allowed) {
    return Response.json(
      { error: "Rate limit exceeded. Please wait before trying again." },
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

  if (action !== "executive-insights") {
    return Response.json({ error: "Unknown action" }, { status: 400 });
  }

  return executiveInsights(workspace, payload);
}

async function executiveInsights(workspace: any, payload: any) {
  const {
    portfolioEconomics: pe,
    capabilityArchitecture: ca,
    applicationPortfolio: ap,
    riskCompliance: rc,
    transformation: tr,
    crossModuleSignals: cms,
    actionItemsSummary,
  } = payload;

  const frameworkLines = (rc.perFrameworkScores ?? [])
    .map((f: any) => `  - ${f.framework.replace(/_/g, " ")}: ${f.score}% (${f.compliant}/${f.total} compliant, ${f.nonCompliant} non-compliant, ${f.notAssessed} not assessed)`)
    .join("\n");

  const prompt = `You are the Chief Enterprise Architect at a major enterprise, preparing the quarterly Executive Architecture Health Brief for the Board Technology & Risk Committee.

This report will be read by the CEO, CFO, CRO, and non-executive directors. It must be decision-grade: every statement traceable to data, every recommendation tied to business impact.

Reference frameworks: TOGAF ADM Phase G (Implementation Governance), COBIT 2019 (Governance & Management Objectives), ISO 38500 (IT Governance), and the Gartner IT Score methodology.

CLIENT: ${workspace.clientName || workspace.name}
INDUSTRY: ${workspace.industry}

═══════════════════════════════════════════════════
1. PORTFOLIO ECONOMICS
═══════════════════════════════════════════════════
- Total Annual Application Portfolio Spend: ${fmtCost(pe.totalAnnualCost)}
- Spend on ACTIVE apps: ${fmtCost(pe.activeCost)} (${pe.activeCostPct}%)
- Spend on PHASING_OUT / SUNSET / RETIRED apps: ${fmtCost(pe.legacyCost)} (${pe.legacyCostPct}%)
- Top 5 Vendors by Spend: ${pe.topVendorsBySpend?.join("; ") || "N/A"}
- Vendor Concentration: ${pe.topVendorName} accounts for ${pe.topVendorPct}% of portfolio spend

═══════════════════════════════════════════════════
2. CAPABILITY ARCHITECTURE
═══════════════════════════════════════════════════
- Total Business Capabilities: ${ca.totalCapabilities}
- Critical Capabilities: ${ca.criticalCapabilities}
- Critical Capabilities with No Application Support: ${ca.unsupportedCritical}${ca.unsupportedCriticalNames?.length ? ` (${ca.unsupportedCriticalNames.join(", ")})` : ""}
- Maturity Distribution: ${fmtDist(ca.maturityDistribution ?? {})}
- Average Maturity Gap (current vs target): ${ca.avgMaturityGap} levels
- Capabilities with Maturity Gap >= 2 Levels: ${ca.largeGapCount} (of which ${ca.largeGapCriticalCount} are CRITICAL importance)
- CRITICAL Capabilities at INITIAL maturity: ${ca.immatureCriticalCount}${ca.immatureCriticalNames?.length ? ` (${ca.immatureCriticalNames.join(", ")})` : ""}

═══════════════════════════════════════════════════
3. APPLICATION PORTFOLIO HEALTH
═══════════════════════════════════════════════════
- Total Applications: ${ap.totalApplications}
- Lifecycle Distribution: ${fmtDist(ap.lifecycleDistribution ?? {})}
- Technical Health Distribution: ${fmtDist(ap.healthDistribution ?? {})}
- Business Value Distribution: ${fmtDist(ap.businessValueDistribution ?? {})}
- Applications with POOR/CRITICAL health supporting CRITICAL capabilities: ${ap.toxicAppCount}${ap.toxicAppNames?.length ? ` (${ap.toxicAppNames.join(", ")})` : ""}
- Applications past EOL date still active: ${ap.pastEolActiveCount}
- Redundancy: ${ap.redundantCapabilityCount} capabilities served by 2+ applications

═══════════════════════════════════════════════════
4. RISK & COMPLIANCE POSTURE
═══════════════════════════════════════════════════
- Open Risks: ${rc.openRisks} | Critical (score >= 12): ${rc.criticalRisks}
- Unmitigated Risks: ${rc.unmitigated}
- Risk Distribution by Category: ${fmtDist(rc.byCategory ?? {})}
- EOL Exposure: ${rc.eolExpired} expired, ${rc.eolUrgent} urgent (< 90 days)
- Compliance Scores by Framework:
${frameworkLines || "  No frameworks imported"}
- Average Compliance Score: ${rc.avgComplianceScore}%
- Frameworks Below 50%: ${rc.weakFrameworks?.join(", ") || "None"}

═══════════════════════════════════════════════════
5. TRANSFORMATION ROADMAP
═══════════════════════════════════════════════════
- Total Initiatives: ${tr.totalInitiatives}
- By Status: ${fmtDist(tr.byStatus ?? {})}
- RAG Distribution: ${fmtDist(tr.ragDistribution ?? {})}
- Overdue Initiatives: ${tr.overdueCount}
- Budget Allocated: ${fmtCost(tr.totalBudget)} | Avg Progress: ${tr.avgProgress}%
- Completed (last 90 days): ${tr.recentlyCompleted}
- Strategic Objectives Linked: ${tr.linkedObjectives} of ${tr.totalObjectives}
- Initiatives with RED RAG: ${tr.redInitiatives?.length ?? 0}${tr.redInitiatives?.length ? ` (${tr.redInitiatives.join(", ")})` : ""}

═══════════════════════════════════════════════════
6. CROSS-MODULE RISK SIGNALS
═══════════════════════════════════════════════════
- EOL-risk apps supporting CRITICAL capabilities: ${cms.eolCriticalCount}${cms.eolCriticalNames?.length ? ` (${cms.eolCriticalNames.join(", ")})` : ""}
- CRITICAL capabilities at INITIAL maturity: ${cms.immatureCriticalCount}
- Active initiatives with RED RAG status: ${tr.redInitiatives?.length ?? 0}

TOP ACTION ITEMS (by severity):
${actionItemsSummary || "None recorded"}

═══════════════════════════════════════════════════

TASK:
Produce the Executive Architecture Health Brief in the JSON format below.

OUTPUT FORMAT (JSON only, no markdown):
{
  "architectureHealthScore": <integer 0-100>,
  "ragByDomain": {
    "capabilities": "GREEN" | "AMBER" | "RED",
    "applications": "GREEN" | "AMBER" | "RED",
    "riskCompliance": "GREEN" | "AMBER" | "RED",
    "transformation": "GREEN" | "AMBER" | "RED"
  },
  "headline": "single sentence — the one thing the board must understand",
  "executiveBrief": "4–5 paragraphs. Paragraph 1: Overall posture and architecture health score justification. Paragraph 2: Capability architecture — maturity gaps, unsupported critical capabilities, strategic alignment. Paragraph 3: Application portfolio — economics, technical debt, vendor concentration, redundancy. Paragraph 4: Risk and compliance — posture, trajectory, critical exposures. Paragraph 5: Transformation progress — delivery velocity, RAG health, budget utilisation, and whether current initiatives address the identified gaps. Use plain prose, no bullet points, no markdown.",
  "keySignals": [
    {
      "type": "RISK" | "OPPORTUNITY" | "WARNING",
      "domain": "CAPABILITIES" | "APPLICATIONS" | "RISK_COMPLIANCE" | "TRANSFORMATION",
      "signal": "1–2 sentences citing specific numbers from the snapshot",
      "businessImpact": "1 sentence on what this means for the business"
    }
  ],
  "recommendedFocus": [
    {
      "horizon": "30d",
      "action": "specific, actionable recommendation",
      "rationale": "why this, why now — tied to data",
      "owner": "CTO" | "CIO" | "CISO" | "CFO" | "Business Unit Lead",
      "estimatedImpact": "what changes if this is done"
    },
    { "horizon": "60d", "action": "...", "rationale": "...", "owner": "...", "estimatedImpact": "..." },
    { "horizon": "90d", "action": "...", "rationale": "...", "owner": "...", "estimatedImpact": "..." }
  ],
  "portfolioEconomicsInsight": "2–3 sentences on spend efficiency — what % is going to legacy, where consolidation could save money, vendor concentration risk",
  "industryContext": "2–3 sentences benchmarking the client's posture against typical organisations in their industry based on your knowledge of industry norms",
  "dataQualityNotes": ["caveats about sparse or missing data that may affect confidence in this assessment"]
}

RULES:
- ARCHITECTURE HEALTH SCORE: Composite of all four domains. Deduct points for: each critical unsupported capability (-5), each critical risk (-3), each framework below 50% (-5), each RED initiative (-3), legacy spend above 20% of portfolio (-5), avg maturity gap > 1.5 levels (-5). Start at 100.
- RAG BY DOMAIN: Assess each independently. RED = immediate leadership action required. AMBER = deteriorating or concerning. GREEN = healthy.
- KEY SIGNALS: Return 4–8, ordered by business impact. Every signal MUST cite at least one specific number from the snapshot. Tag each with the domain it belongs to.
- RECOMMENDED FOCUS: Exactly 3 (one per horizon). Must be concrete enough to assign to a named executive role. Never generic.
- INDUSTRY CONTEXT: Draw on your knowledge of typical architecture maturity in ${workspace.industry}. Be specific (e.g., "regulated financial services organisations typically target >70% compliance scores").
- PORTFOLIO ECONOMICS: Always flag if legacy spend exceeds 15% of total — this is a board-level concern in any industry.
- Do NOT invent data points. Only reference numbers from the snapshot.
- TONE: Board-level. Authoritative. Decision-oriented. No jargon. Every paragraph must answer "so what?" for a non-technical director.`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 5000,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const text = (message.content[0] as any).text;
    const parsed = JSON.parse(stripCodeBlock(text));
    return Response.json(parsed);
  } catch {
    return Response.json(
      {
        architectureHealthScore: 0,
        headline: "Unable to generate insights at this time.",
        executiveBrief: "",
        keySignals: [],
        recommendedFocus: [],
        dataQualityNotes: ["AI response could not be parsed."],
      },
      { status: 200 }
    );
  }
}
