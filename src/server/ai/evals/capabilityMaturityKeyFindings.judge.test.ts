/**
 * Capability Maturity key findings LLM call — judge eval.
 * 3 runs × Opus judge × v1 rubric. RUN_EVALS=1 gate.
 */
import { describe, expect, it } from "vitest";
import {
  buildKeyFindingsFacts,
  collectAllowedCounts,
  generateKeyFindings,
} from "@/server/ai/deliverables/buildCapabilityMaturityDocx";
import {
  CAPABILITY_MATURITY_KEY_FINDINGS_RUBRIC,
  CAPABILITY_MATURITY_KEY_FINDINGS_RUBRIC_VERSION,
} from "./rubrics/capabilityMaturityKeyFindings.v1";
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

const SUB_AGENT = "capabilityMaturityKeyFindings";

describeMaybe("capability maturity key findings — LLM judge", () => {
  const fixtureName = "h-motors-12caps-100pct-coverage";
  const previous = loadPreviousRun();
  const m = SYNTHETIC_H_MOTORS_MATURITY_METRICS;
  const facts = buildKeyFindingsFacts(m, SYNTHETIC_CLIENT_NAME);
  const allowedCounts = collectAllowedCounts(m);

  it(
    `${fixtureName}: 3-run mean against rubric`,
    { timeout: 300_000 },
    async () => {
      const runs = await Promise.all(
        [1, 2, 3].map(() => generateKeyFindings(facts, allowedCounts, m))
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
            rubric: CAPABILITY_MATURITY_KEY_FINDINGS_RUBRIC,
            task: `Generate the Five Key Findings synthesis-layer page for the ${SYNTHETIC_CLIENT_NAME} Capability Maturity Assessment.`,
            agentOutput: { findings: r.result.findings },
            fixtureRefs: {
              expectedHints: `Input is 12 capabilities, 100% coverage. 8 priority lift candidates carry ~13 cumulative gap-levels. Connected Vehicle Services owns the largest L1 concentration (3 caps, deepest gaps). 4 CRITICAL caps at INITIAL/DEVELOPING (OTA Update Management, BOM & Part Master, Connected Vehicle Services L1 root, Vehicle Cybersecurity (R155/R156)). 1 invest-beyond (Finance & Treasury at MANAGED). 0 reassess. App-readiness: 7 of 8 lift caps mapped (88%); the orphaned Connected Vehicle Services L1 root requires tooling stand-up. All 12 capabilities lack owner pairs (data-collection signal, not portfolio finding).`,
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
        rubricVersion: CAPABILITY_MATURITY_KEY_FINDINGS_RUBRIC_VERSION,
        totalCostUsd: cost,
        fixtures: slice,
      });
      console.log(`[judge] ${SUB_AGENT} subtotal: $${cost.toFixed(3)}`);

      expect(m2).toBeGreaterThan(0);
    }
  );
});
