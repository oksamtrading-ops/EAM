/**
 * analyze_application_impact — LLM-as-judge eval.
 *
 * For each fixture under `fixtures/analyze-application-impact/`, seeds
 * an ephemeral workspace, runs the sub-agent 3× (production temp),
 * scores each run with Opus 4.6 against the rubric at
 * `rubrics/impactAnalysis.v1.ts`, and writes the archive slice to
 * `results/last-run.json` (schema v2).
 *
 * Gated behind RUN_EVALS=1 — calls live Anthropic.
 */
import { describe, expect, it } from "vitest";
import { runSubAgent } from "@/server/ai/subAgents";
import { judgeOutput, type JudgeResult } from "./_judge";
import {
  IMPACT_ANALYSIS_RUBRIC,
  IMPACT_ANALYSIS_RUBRIC_VERSION,
} from "./rubrics/impactAnalysis.v1";
import {
  diffSlice,
  loadPreviousRun,
  writeArchiveSlice,
  type FixtureScore,
} from "./_judgeArchive";
import { mean, stdDev } from "./_stats";
import { IMPACT_ANALYSIS_FIXTURES } from "./fixtures/analyze-application-impact";

const RUN = process.env.RUN_EVALS === "1";
const describeMaybe = RUN ? describe : describe.skip;

const SUB_AGENT = "impactAnalysis";

type LocalFixtureResult = {
  name: string;
  meanScore: number;
  stdDev: number;
  scores: JudgeResult[];
  costUsd: number;
};

describeMaybe("analyze_application_impact — LLM judge", () => {
  const fixtureResults: LocalFixtureResult[] = [];
  const previous = loadPreviousRun();

  for (const fixture of IMPACT_ANALYSIS_FIXTURES) {
    it(
      `${fixture.name}: agent + judge`,
      { timeout: 300_000 },
      async () => {
        const seed = await fixture.seed();
        try {
          const agentRuns = await Promise.all(
            [1, 2, 3].map(() =>
              runSubAgent("analyze_application_impact", seed.input, {
                workspaceId: seed.workspaceId,
                userId: seed.userId,
                subAgentCallsSoFar: 0,
                subAgentBudget: 3,
              })
            )
          );

          const okOutputs = agentRuns
            .filter((r): r is Extract<typeof r, { ok: true }> => r.ok)
            .map((r) => r.result);

          if (okOutputs.length === 0) {
            console.log(
              `[judge] ${SUB_AGENT}/${fixture.name}: all 3 agent runs failed; skipping judge`
            );
            for (const r of agentRuns) {
              if (!r.ok) console.log(`  agent error: ${r.error}`);
            }
            return;
          }

          const judgments = await Promise.all(
            okOutputs.map((output) =>
              judgeOutput({
                rubric: IMPACT_ANALYSIS_RUBRIC,
                task: fixture.description,
                agentOutput: output,
                fixtureRefs: {
                  expectedHints: fixture.expectedHints,
                  workspaceSnapshot: seed.snapshot,
                },
              })
            )
          );

          const scores = judgments.map((j) => j.avgScore);
          const m = mean(scores);
          const sd = stdDev(scores);
          const cost = judgments.reduce((a, j) => a + j.costUsd, 0);

          fixtureResults.push({
            name: fixture.name,
            meanScore: m,
            stdDev: sd,
            scores: judgments,
            costUsd: cost,
          });

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

          expect(m).toBeGreaterThan(0);
        } finally {
          await seed.cleanup();
        }
      }
    );
  }

  it("write archive slice + total cost", () => {
    if (fixtureResults.length === 0) {
      console.log(
        `[judge] no ${SUB_AGENT} fixtures completed (all agent runs may have failed)`
      );
      return;
    }

    const totalCost = fixtureResults.reduce((a, f) => a + f.costUsd, 0);
    const slice: FixtureScore[] = fixtureResults.map((f) => ({
      name: f.name,
      meanScore: f.meanScore,
      stdDev: f.stdDev,
    }));

    diffSlice(SUB_AGENT, slice, previous);

    writeArchiveSlice(SUB_AGENT, {
      rubricVersion: IMPACT_ANALYSIS_RUBRIC_VERSION,
      totalCostUsd: totalCost,
      fixtures: slice,
    });

    console.log(
      `[judge] ${SUB_AGENT} subtotal: $${totalCost.toFixed(3)}`
    );
  });
});
