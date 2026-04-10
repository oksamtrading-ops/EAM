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
    case "rationalization-narrative":
      return generateRationalizationNarrative(workspace, payload);
    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
  }
}

async function generateRationalizationNarrative(workspace: any, payload: { apps: any[] }) {
  const appList = payload.apps
    .map(
      (a) =>
        `- ${a.name} (${a.vendor ?? "no vendor"}) | Lifecycle: ${a.lifecycle} | BV: ${a.businessValue} | TH: ${a.technicalHealth} | Rationalization: ${a.rationalizationStatus} | Cost: ${a.annualCostUsd ? "$" + a.annualCostUsd.toLocaleString() : "N/A"} | Caps: ${a.capabilityCount}`
    )
    .join("\n");

  const totalCost = payload.apps.reduce((sum, a) => sum + (a.annualCostUsd ?? 0), 0);
  const retireCount = payload.apps.filter(
    (a) => a.rationalizationStatus === "RETIRE" || ((a.businessValue === "LOW" || a.businessValue === "BV_UNKNOWN") && (a.technicalHealth === "POOR" || a.technicalHealth === "TH_CRITICAL"))
  ).length;

  const prompt = `You are a senior enterprise architect preparing a portfolio rationalization analysis for a consulting client.

CLIENT: ${workspace.clientName || workspace.name}
INDUSTRY: ${workspace.industry}
TOTAL APPLICATIONS: ${payload.apps.length}
TOTAL ANNUAL IT SPEND: $${totalCost.toLocaleString()}

APPLICATION PORTFOLIO:
${appList}

TASK:
Write a professional portfolio rationalization narrative (350-500 words) that:
1. Opens with an executive summary of the portfolio health (total apps, cost distribution, lifecycle breakdown)
2. Identifies the top 3 rationalization priorities (highest cost + lowest value, or critical health issues)
3. Quantifies potential savings from retiring/consolidating low-value applications
4. Highlights redundancy risks (multiple apps supporting the same capabilities)
5. Closes with recommended next steps for the rationalization program

TONE: Objective, data-driven, consultant-grade. Suitable for a C-suite presentation.
FORMAT: Plain prose with section headers. No bullet points. No markdown tables.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  return Response.json({ narrative: (message.content[0] as any).text });
}
