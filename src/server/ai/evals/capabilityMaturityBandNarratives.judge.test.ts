/**
 * Capability Maturity band-narratives LLM call — judge eval.
 * 3 runs × Opus judge × v1 rubric. RUN_EVALS=1 gate.
 */
import { describe, expect, it } from "vitest";
import {
  buildBandNarrativesFacts,
  collectAllowedCounts,
  generateBandNarratives,
} from "@/server/ai/deliverables/buildCapabilityMaturityDocx";
import {
  CAPABILITY_MATURITY_BAND_NARRATIVES_RUBRIC,
  CAPABILITY_MATURITY_BAND_NARRATIVES_RUBRIC_VERSION,
} from "./rubrics/capabilityMaturityBandNarratives.v1";
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

const SUB_AGENT = "capabilityMaturityBandNarratives";

describeMaybe("capability maturity band narratives — LLM judge", () => {
  const fixtureName = "h-motors-12caps-100pct-coverage";
  const previous = loadPreviousRun();
  const m = SYNTHETIC_H_MOTORS_MATURITY_METRICS;
  const facts = buildBandNarrativesFacts(m, SYNTHETIC_CLIENT_NAME);
  const allowedCounts = collectAllowedCounts(m);

  it(
    `${fixtureName}: 3-run mean against rubric`,
    { timeout: 300_000 },
    async () => {
      const runs = await Promise.all(
        [1, 2, 3].map(() => generateBandNarratives(facts, allowedCounts, m))
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
            rubric: CAPABILITY_MATURITY_BAND_NARRATIVES_RUBRIC,
            task: `Generate the four band-narratives (LIFT_TO_TARGET / SUSTAIN / INVEST_BEYOND_TARGET / REASSESS_STRATEGY) for the ${SYNTHETIC_CLIENT_NAME} Capability Maturity Assessment.`,
            agentOutput: r.result.narratives,
            fixtureRefs: {
              expectedHints: `LIFT_TO_TARGET has 8 capabilities (top: OTA Update Management, Software & Electronics Engineering, BOM & Part Master, Vehicle Cybersecurity (R155/R156), Plant-Floor Execution (MES)) anchored on Connected Vehicle Services + Vehicle Engineering & Design. SUSTAIN has 2 (Paint Shop, Dealer Onboarding) — counterfactual must be literal "—". INVEST_BEYOND_TARGET has 1 (Finance & Treasury at MANAGED, mapped to SAP ECC 6.0 [MIGRATE]). REASSESS_STRATEGY has 0 — return all fields as "—".`,
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
        rubricVersion: CAPABILITY_MATURITY_BAND_NARRATIVES_RUBRIC_VERSION,
        totalCostUsd: cost,
        fixtures: slice,
      });
      console.log(`[judge] ${SUB_AGENT} subtotal: $${cost.toFixed(3)}`);

      expect(m2).toBeGreaterThan(0);
    }
  );
});
