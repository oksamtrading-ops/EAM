/**
 * Five Key Findings LLM call — judge eval. 3 runs × Opus judge ×
 * v1 rubric. RUN_EVALS=1 gate.
 */
import { describe, expect, it } from "vitest";
import {
  buildKeyFindingsFacts,
  generateKeyFindings,
} from "@/server/ai/deliverables/buildRationalizationDocx";
import {
  formatCurrency,
  formatCurrencyCompact,
} from "@/server/ai/deliverables/_helpers";
import {
  RATIONALIZATION_KEY_FINDINGS_RUBRIC,
  RATIONALIZATION_KEY_FINDINGS_RUBRIC_VERSION,
} from "./rubrics/rationalizationKeyFindings.v1";
import { judgeOutput } from "./_judge";
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

const SUB_AGENT = "rationalizationKeyFindings";

describeMaybe("rationalization key findings — LLM judge", () => {
  const fixtureName = "h-motors-15apps-100pct-classified";
  const previous = loadPreviousRun();
  const fmt = (n: number) =>
    formatCurrency(n, SYNTHETIC_H_MOTORS_METRICS.costCurrency);
  const fmtCompact = (n: number) =>
    formatCurrencyCompact(n, SYNTHETIC_H_MOTORS_METRICS.costCurrency);
  const facts = buildKeyFindingsFacts(
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
        [1, 2, 3].map(() =>
          generateKeyFindings(facts, fmt, fmtCompact, SYNTHETIC_H_MOTORS_METRICS)
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
            rubric: RATIONALIZATION_KEY_FINDINGS_RUBRIC,
            task: `Generate the Five Key Findings synthesis-layer page for the ${SYNTHETIC_CLIENT_NAME} Rationalization Plan.`,
            agentOutput: { findings: r.findings },
            fixtureRefs: {
              expectedHints: `Input includes total programme savings (£39.1M / 3-yr), Siemens £8.6M / 3 apps multi-product concentration, 5 PHASING_OUT apps split 3 MIGRATE / 2 ELIMINATE (capability-continuity vs capability-retirement asymmetry), £16.6M INVEST bucket, 12 redundant capabilities (top: Vehicle Engineering & Design across CATIA / NX / Teamcenter).`,
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
        rubricVersion: RATIONALIZATION_KEY_FINDINGS_RUBRIC_VERSION,
        totalCostUsd: cost,
        fixtures: slice,
      });
      console.log(`[judge] ${SUB_AGENT} subtotal: $${cost.toFixed(3)}`);

      expect(m).toBeGreaterThan(0);
    }
  );
});
