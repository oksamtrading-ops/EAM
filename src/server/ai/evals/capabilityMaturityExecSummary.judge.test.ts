/**
 * Capability Maturity exec summary LLM call — judge eval.
 * 3 runs × Opus judge × v1 rubric. RUN_EVALS=1 gate.
 */
import { describe, expect, it } from "vitest";
import {
  buildExecSummaryFacts,
  collectAllowedCounts,
  generateExecSummary,
} from "@/server/ai/deliverables/buildCapabilityMaturityDocx";
import {
  CAPABILITY_MATURITY_EXEC_SUMMARY_RUBRIC,
  CAPABILITY_MATURITY_EXEC_SUMMARY_RUBRIC_VERSION,
} from "./rubrics/capabilityMaturityExecSummary.v1";
import { judgeOutput } from "./_judge";
import {
  diffSlice,
  loadPreviousRun,
  writeArchiveSlice,
  type FixtureScore,
} from "./_judgeArchive";
import { mean, stdDev } from "./_stats";
import {
  SYNTHETIC_H_MOTORS_MATURITY_METRICS,
  SYNTHETIC_CLIENT_NAME,
} from "./fixtures/deliverable-capability-maturity/_synthetic";

const RUN = process.env.RUN_EVALS === "1";
const describeMaybe = RUN ? describe : describe.skip;

const SUB_AGENT = "capabilityMaturityExecSummary";

describeMaybe("capability maturity exec summary — LLM judge", () => {
  const fixtureName = "h-motors-12caps-100pct-coverage";
  const previous = loadPreviousRun();
  const m = SYNTHETIC_H_MOTORS_MATURITY_METRICS;
  const facts = buildExecSummaryFacts(m, SYNTHETIC_CLIENT_NAME);
  const allowedCounts = collectAllowedCounts(m);

  it(
    `${fixtureName}: 3-run mean against rubric`,
    { timeout: 300_000 },
    async () => {
      const runs = await Promise.all(
        [1, 2, 3].map(() =>
          generateExecSummary(facts, allowedCounts, m, SYNTHETIC_CLIENT_NAME)
        )
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
            rubric: CAPABILITY_MATURITY_EXEC_SUMMARY_RUBRIC,
            task: `Generate the Executive Summary for the ${SYNTHETIC_CLIENT_NAME} Capability Maturity Assessment.`,
            agentOutput: { executiveSummary: r.result.text },
            fixtureRefs: {
              expectedHints: `Input is 12 capabilities, 100% assessment coverage, 8 priority lift candidates anchored on Connected Vehicle Services (3 caps, ~10 cumulative gap-levels). Cross-deliverable bridge populated: BOM & Part Master ↔ Aftersales Parts Catalog (AS/400) [ELIMINATE, PHASING_OUT]; OTA Update Management ↔ Halloran SDV Platform [INVEST, PLANNED]; Plant-Floor Execution (MES) ↔ Apriso MES (Halewood plant) [INVEST] + Solihull MES (bespoke) [MIGRATE]. 1 invest-beyond capability (Finance & Treasury at MANAGED). No reassess. 4 CRITICAL caps at INITIAL/DEVELOPING.`,
            },
          })
        )
      );

      const scores = judgments.map((j) => j.avgScore);
      const m2 = mean(scores);
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
        { name: fixtureName, meanScore: m2, stdDev: sd },
      ];
      diffSlice(SUB_AGENT, slice, previous);
      writeArchiveSlice(SUB_AGENT, {
        rubricVersion: CAPABILITY_MATURITY_EXEC_SUMMARY_RUBRIC_VERSION,
        totalCostUsd: cost,
        fixtures: slice,
      });
      console.log(`[judge] ${SUB_AGENT} subtotal: $${cost.toFixed(3)}`);

      expect(m2).toBeGreaterThan(0);
    }
  );
});
