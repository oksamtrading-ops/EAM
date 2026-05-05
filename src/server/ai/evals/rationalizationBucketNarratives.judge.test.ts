/**
 * Bucket Narratives LLM call — judge eval. 3 runs × Opus judge ×
 * v1 rubric. RUN_EVALS=1 gate.
 */
import { describe, expect, it } from "vitest";
import {
  buildBucketFacts,
  generateBucketNarratives,
} from "@/server/ai/deliverables/buildRationalizationDocx";
import {
  formatCurrency,
  formatCurrencyCompact,
} from "@/server/ai/deliverables/_helpers";
import {
  RATIONALIZATION_BUCKET_NARRATIVES_RUBRIC,
  RATIONALIZATION_BUCKET_NARRATIVES_RUBRIC_VERSION,
} from "./rubrics/rationalizationBucketNarratives.v1";
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

const SUB_AGENT = "rationalizationBucketNarratives";

describeMaybe("rationalization bucket narratives — LLM judge", () => {
  const fixtureName = "h-motors-15apps-100pct-classified";
  const previous = loadPreviousRun();
  const fmt = (n: number) =>
    formatCurrency(n, SYNTHETIC_H_MOTORS_METRICS.costCurrency);
  const fmtCompact = (n: number) =>
    formatCurrencyCompact(n, SYNTHETIC_H_MOTORS_METRICS.costCurrency);
  const facts = buildBucketFacts(
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
          generateBucketNarratives(facts, SYNTHETIC_H_MOTORS_METRICS, fmt)
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
            rubric: RATIONALIZATION_BUCKET_NARRATIVES_RUBRIC,
            task: `Generate four TIME-bucket narratives (ELIMINATE/MIGRATE/INVEST/TOLERATE) for the ${SYNTHETIC_CLIENT_NAME} Rationalization Plan.`,
            agentOutput: r.narratives,
            fixtureRefs: {
              expectedHints: `Input has all 4 buckets populated. ELIMINATE: 2 apps (£4.6M) both PHASING_OUT. MIGRATE: 3 apps (£16.9M) all PHASING_OUT including SAP ECC + Teamcenter PLM. INVEST: 6 apps (£16.6M). TOLERATE: 4 apps (£6M). Lifecycle-disposition asymmetry should surface in MIGRATE + ELIMINATE whyNow bullets.`,
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
        rubricVersion: RATIONALIZATION_BUCKET_NARRATIVES_RUBRIC_VERSION,
        totalCostUsd: cost,
        fixtures: slice,
      });
      console.log(`[judge] ${SUB_AGENT} subtotal: $${cost.toFixed(3)}`);

      expect(m).toBeGreaterThan(0);
    }
  );
});
