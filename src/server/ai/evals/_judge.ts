import "server-only";
import { anthropic, classifyAnthropicError } from "@/server/ai/client";
import { MODEL_OPUS } from "@/server/ai/models";
import { estimateRunCostUsd } from "@/lib/utils/agentPricing";

/**
 * LLM-as-judge harness for sub-agent quality regression detection.
 *
 * Pinned to Opus 4.6: the judge must be at least as capable as the
 * agent under test (Sonnet 4 today), and Opus's gap over Sonnet is
 * largest on the vision-reasoning task this v1 targets.
 *
 * Pinned to temp 0 for judge determinism; the agent under test runs
 * at production temperature so eval reflects real variance.
 *
 * Rubric is cacheable (`cache_control: ephemeral`) — saves ~$0.01
 * per run after warm-up.
 */

/** Pinned for v1. Bump alongside MODEL_OPUS when judges should
 *  follow the model upgrade. Recorded into result archives so
 *  historical scores stay interpretable across upgrades. */
export const JUDGE_MODEL = MODEL_OPUS;

export type JudgeScores = {
  groundedness: number;
  completeness: number;
  format: number;
  confidenceCalibration: number;
};

export type JudgeResult = {
  scores: JudgeScores;
  avgScore: number;
  issues: string[];
  reasoning: string;
  judgeModel: string;
  costUsd: number;
};

export type JudgeInput = {
  /** Per-sub-agent rubric — the system prompt the judge sees. */
  rubric: string;
  /** Human-readable description of what the agent was asked to do. */
  task: string;
  /** The JSON output the agent produced. */
  agentOutput: unknown;
  /** Optional context: source image (for vision judging) and free-text hints. */
  fixtureRefs?: {
    sourceImageBase64?: string;
    sourceImageMimeType?: "image/png" | "image/jpeg" | "image/webp";
    expectedHints?: string;
  };
};

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

export async function judgeOutput(opts: JudgeInput): Promise<JudgeResult> {
  const userBlocks: Array<Record<string, unknown>> = [];

  if (
    opts.fixtureRefs?.sourceImageBase64 &&
    opts.fixtureRefs?.sourceImageMimeType
  ) {
    userBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: opts.fixtureRefs.sourceImageMimeType,
        data: opts.fixtureRefs.sourceImageBase64,
      },
    });
  }

  const userText = [
    `# Task given to the agent`,
    opts.task,
    opts.fixtureRefs?.expectedHints
      ? `\n# Hints about the source\n${opts.fixtureRefs.expectedHints}`
      : "",
    `\n# Agent output (JSON)`,
    "```json",
    JSON.stringify(opts.agentOutput, null, 2),
    "```",
    "",
    `Score this output per the rubric. Return strict JSON only.`,
  ]
    .filter(Boolean)
    .join("\n");

  userBlocks.push({ type: "text", text: userText });

  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: JUDGE_MODEL,
        max_tokens: 2000,
        temperature: 0,
        system: [
          {
            type: "text" as const,
            text: opts.rubric,
            cache_control: { type: "ephemeral" as const },
          },
        ],
        messages: [
          { role: "user", content: userBlocks as never },
          // Anthropic-prefill so the model continues mid-JSON.
          // parseJson reattaches the leading "{" before parsing.
          { role: "assistant", content: "{" },
        ],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      const raw =
        textBlock && "text" in textBlock ? (textBlock.text as string) : "";

      const parsed = parseJudgeJson(raw);
      const scores = normalizeScores(parsed.scores);
      const avgScore =
        (scores.groundedness +
          scores.completeness +
          scores.format +
          scores.confidenceCalibration) /
        4;

      const usage = response.usage as
        | { input_tokens?: number; output_tokens?: number }
        | undefined;
      const costUsd = estimateRunCostUsd({
        model: JUDGE_MODEL,
        totalTokensIn: usage?.input_tokens ?? 0,
        totalTokensOut: usage?.output_tokens ?? 0,
      });

      return {
        scores,
        avgScore,
        issues: Array.isArray(parsed.issues)
          ? parsed.issues.map((s: unknown) => String(s)).slice(0, 20)
          : [],
        reasoning:
          typeof parsed.reasoning === "string" ? parsed.reasoning : "",
        judgeModel: JUDGE_MODEL,
        costUsd,
      };
    } catch (err) {
      lastErr = err;
      const info = classifyAnthropicError(err);
      if (!info.retriable || attempt === MAX_RETRIES) {
        throw err;
      }
      console.warn(
        JSON.stringify({
          evt: "judge_retry",
          attempt: attempt + 1,
          code: info.code,
        })
      );
      await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastErr ?? new Error("judge: unreachable");
}

function parseJudgeJson(text: string): {
  scores?: unknown;
  issues?: unknown;
  reasoning?: unknown;
} {
  // Anthropic-prefill {"…} — reattach the leading "{".
  const candidate = "{" + text;
  return JSON.parse(candidate);
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function normalizeScores(raw: unknown): JudgeScores {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    groundedness: clamp(Number(r.groundedness ?? 0), 0, 10),
    completeness: clamp(Number(r.completeness ?? 0), 0, 10),
    format: clamp(Number(r.format ?? 0), 0, 10),
    confidenceCalibration: clamp(Number(r.confidenceCalibration ?? 0), 0, 10),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
