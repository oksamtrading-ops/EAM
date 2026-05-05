/**
 * Executive Summary LLM call — judge eval.
 *
 * Calls `generateExecutiveSummary` 3× against the synthetic
 * H Motors-equivalent metrics fixture, scores each output with
 * Opus 4.6 against the v1 rubric, archives the slice. Smoke
 * threshold > 0; tighten after 5–10 baseline runs.
 *
 * Gated behind RUN_EVALS=1 — calls live Anthropic.
 */
import { describe, expect, it } from "vitest";
import {
  buildExecSummaryFacts,
  generateExecutiveSummary,
} from "@/server/ai/deliverables/buildRationalizationDocx";
import {
  formatCurrency,
  formatCurrencyCompact,
} from "@/server/ai/deliverables/_helpers";
import {
  RATIONALIZATION_EXEC_SUMMARY_RUBRIC,
  RATIONALIZATION_EXEC_SUMMARY_RUBRIC_VERSION,
} from "./rubrics/rationalizationExecSummary.v1";
import { judgeOutput, type JudgeResult } from "./_judge";
import {
  diffSlice,
  loadPreviousRun,
  writeArchiveSlice,
  type FixtureScore,
} from "./_judgeArchive";
import { mean, stdDev } from "./_stats";
import {
  SYNTHETIC_H_MOTORS_METRICS,
  SYNTHETIC_CLIENT_NAME,
} from "./fixtures/deliverable-rationalization/_synthetic";

const RUN = process.env.RUN_EVALS === "1";
const describeMaybe = RUN ? describe : describe.skip;

const SUB_AGENT = "rationalizationExecSummary";

describeMaybe("rationalization exec summary — LLM judge", () => {
  const fixtureName = "h-motors-15apps-100pct-classified";
  const previous = loadPreviousRun();
  const fmt = (n: number) =>
    formatCurrency(n, SYNTHETIC_H_MOTORS_METRICS.costCurrency);
  const fmtCompact = (n: number) =>
    formatCurrencyCompact(n, SYNTHETIC_H_MOTORS_METRICS.costCurrency);
  const facts = buildExecSummaryFacts(
    SYNTHETIC_H_MOTORS_METRICS,
    fmt,
    fmtCompact,
    SYNTHETIC_CLIENT_NAME
  );

  it(
    `${fixtureName}: 3-run mean against rubric`,
    { timeout: 300_000 },
    async () => {
      const runs = await Promise.all(
        [1, 2, 3].map(() => generateExecutiveSummary(facts))
      );
      const llmRuns = runs.filter((r) => r.source === "llm");
      if (llmRuns.length === 0) {
        console.log(
          `[judge] ${SUB_AGENT}/${fixtureName}: all 3 generations fell back to deterministic; skipping judge`
        );
        return;
      }

      const judgments = await Promise.all(
        llmRuns.map((r) =>
          judgeOutput({
            rubric: RATIONALIZATION_EXEC_SUMMARY_RUBRIC,
            task: `Generate the Executive Summary for the ${SYNTHETIC_CLIENT_NAME} Application Rationalization Plan.`,
            agentOutput: { executiveSummary: r.text },
            fixtureRefs: {
              expectedHints: `Facts input includes 4 bucket totals (TOLERATE/INVEST/MIGRATE/ELIMINATE), projected 3-yr savings, multi-product vendor concentration on Siemens (£8.6M / 3 apps), redundancy on Vehicle Engineering & Design (3 apps).`,
            },
          })
        )
      );

      const scores = judgments.map((j) => j.avgScore);
      const m = mean(scores);
      const sd = stdDev(scores);
      const cost = judgments.reduce((a, j) => a + j.costUsd, 0);

      for (const j of judgments) {
        if (j.avgScore < 7) {
          console.log(
            `[judge]   low score (${j.avgScore.toFixed(1)}): ${j.reasoning}`
          );
          if (j.issues.length) {
            console.log(
              `[judge]   issues: ${j.issues.slice(0, 5).join("; ")}`
            );
          }
        }
      }

      const slice: FixtureScore[] = [
        { name: fixtureName, meanScore: m, stdDev: sd },
      ];
      diffSlice(SUB_AGENT, slice, previous);
      writeArchiveSlice(SUB_AGENT, {
        rubricVersion: RATIONALIZATION_EXEC_SUMMARY_RUBRIC_VERSION,
        totalCostUsd: cost,
        fixtures: slice,
      });
      console.log(`[judge] ${SUB_AGENT} subtotal: $${cost.toFixed(3)}`);

      expect(m).toBeGreaterThan(0);
    }
  );
});
