import "server-only";
import { createHash } from "node:crypto";
import { anthropic } from "@/server/ai/client";
import { MODEL_CLASSIFIER } from "@/server/ai/models";
import {
  RATIONALIZATION_CRITIC_PROMPT,
  RATIONALIZATION_CRITIC_VERSION,
} from "@/server/ai/prompts/rationalizationCritic.v1";
import { db } from "@/server/db";

export type TimeCategory = "TOLERATE" | "INVEST" | "MIGRATE" | "ELIMINATE";

export type CriticVerdict = {
  score: number;
  verdict: "ACCEPT" | "REVISE";
  suggestedClassification: TimeCategory;
  issues: string[];
  rationale: string;
};

export type AppSummary = {
  name: string;
  vendor?: string | null;
  lifecycle: string;
  businessValue: string;
  technicalHealth: string;
  functionalFit?: string | null;
  annualCostUsd?: number | null;
  adoptionRate?: number | null;
  integrationCount?: number;
};

export type RationalizationSingle = {
  classification: TimeCategory;
  rationale: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

const MAX_ITERATIONS = 3;
const ACCEPT_SCORE = 0.8;

export async function evaluateRationalization(opts: {
  workspaceId: string;
  app: AppSummary;
  initial: RationalizationSingle;
}): Promise<{
  runId: string;
  final: RationalizationSingle;
  iterations: number;
  history: Array<{
    proposal: RationalizationSingle;
    critic: CriticVerdict;
  }>;
}> {
  const { workspaceId, app, initial } = opts;

  const inputHash = createHash("sha256")
    .update(`critic|${app.name}|${initial.classification}`)
    .digest("hex")
    .slice(0, 32);

  const run = await db.agentRun.create({
    data: {
      workspaceId,
      kind: "rationalization-critic",
      status: "RUNNING",
      inputHash,
      promptVersion: RATIONALIZATION_CRITIC_VERSION,
      model: MODEL_CLASSIFIER,
    },
    select: { id: true },
  });

  const history: Array<{
    proposal: RationalizationSingle;
    critic: CriticVerdict;
  }> = [];
  let current: RationalizationSingle = initial;
  let ordinal = 0;

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const critic = await runCritic(app, current);
      await db.agentRunStep.create({
        data: {
          runId: run.id,
          ordinal: ordinal++,
          kind: "llm",
          toolName: "critic",
          payload: JSON.parse(
            JSON.stringify({ iteration: i, proposal: current, critic })
          ),
        },
      });
      history.push({ proposal: current, critic });

      if (critic.verdict === "ACCEPT" && critic.score >= ACCEPT_SCORE) break;

      // Regenerate with critic guidance
      current = {
        classification: critic.suggestedClassification,
        rationale:
          critic.rationale ||
          `Revised after critic flagged: ${critic.issues.join("; ")}`,
        confidence:
          critic.score >= 0.9
            ? "HIGH"
            : critic.score >= 0.75
              ? "MEDIUM"
              : "LOW",
      };
    }

    await db.agentRun.update({
      where: { id: run.id },
      data: { status: "SUCCEEDED", endedAt: new Date() },
    });

    return {
      runId: run.id,
      final: current,
      iterations: history.length,
      history,
    };
  } catch (err) {
    await db.agentRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        endedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

async function runCritic(
  app: AppSummary,
  proposal: RationalizationSingle
): Promise<CriticVerdict> {
  const userMessage = `APPLICATION:
${JSON.stringify(app, null, 2)}

ANALYST PROPOSAL:
${JSON.stringify(proposal, null, 2)}

Return the critic JSON per the system prompt.`;

  const response = await anthropic.messages.create({
    model: MODEL_CLASSIFIER,
    max_tokens: 600,
    system: RATIONALIZATION_CRITIC_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw =
    textBlock && "text" in textBlock && typeof textBlock.text === "string"
      ? textBlock.text
      : "";
  const parsed = JSON.parse(extractJson(raw)) as Partial<CriticVerdict>;

  return {
    score: clamp01(Number(parsed.score ?? 0)),
    verdict: parsed.verdict === "ACCEPT" ? "ACCEPT" : "REVISE",
    suggestedClassification: asTime(parsed.suggestedClassification),
    issues: Array.isArray(parsed.issues)
      ? parsed.issues.map(String).slice(0, 10)
      : [],
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
  };
}

function extractJson(raw: string): string {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) return fence[1].trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) return raw.slice(first, last + 1);
  return raw.trim();
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function asTime(v: unknown): TimeCategory {
  const s = String(v ?? "").toUpperCase();
  const allowed: TimeCategory[] = [
    "TOLERATE",
    "INVEST",
    "MIGRATE",
    "ELIMINATE",
  ];
  return (allowed as string[]).includes(s) ? (s as TimeCategory) : "TOLERATE";
}
