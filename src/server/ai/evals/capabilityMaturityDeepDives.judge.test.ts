/**
 * Capability Maturity per-capability deep-dive LLM call — judge eval.
 * 3 runs × Opus judge × v1 rubric. RUN_EVALS=1 gate.
 */
import { describe, expect, it } from "vitest";
import {
  buildDeepDivesFacts,
  collectAllowedCounts,
  generateDeepDives,
} from "@/server/ai/deliverables/buildCapabilityMaturityDocx";
import {
  CAPABILITY_MATURITY_DEEP_DIVES_RUBRIC,
  CAPABILITY_MATURITY_DEEP_DIVES_RUBRIC_VERSION,
} from "./rubrics/capabilityMaturityDeepDives.v1";
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

const SUB_AGENT = "capabilityMaturityDeepDives";

describeMaybe("capability maturity deep dives — LLM judge", () => {
  const fixtureName = "h-motors-12caps-top5";
  const previous = loadPreviousRun();
  const m = SYNTHETIC_H_MOTORS_MATURITY_METRICS;
  const topApps = m.topGapsByImpact.slice(0, 5);
  const facts = buildDeepDivesFacts(topApps, SYNTHETIC_CLIENT_NAME);
  const allowedCounts = collectAllowedCounts(m);

  it(
    `${fixtureName}: 3-run mean against rubric`,
    { timeout: 300_000 },
    async () => {
      const runs = await Promise.all(
        [1, 2, 3].map(() =>
          generateDeepDives(facts, topApps, allowedCounts)
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
            rubric: CAPABILITY_MATURITY_DEEP_DIVES_RUBRIC,
            task: `Generate per-capability deep-dive prose for the top-5 priority capabilities in the ${SYNTHETIC_CLIENT_NAME} Capability Maturity Assessment.`,
            agentOutput: r.result.byId,
            fixtureRefs: {
              expectedHints: `Top-5 by composite priority weight. App-readiness varies: OTA Update Management → Halloran SDV Platform [INVEST, PLANNED]; Software & Electronics Engineering → CATIA V5 [INVEST, ACTIVE] + Halloran SDV Platform [INVEST, PLANNED]; BOM & Part Master → Aftersales Parts Catalog (AS/400) [ELIMINATE, PHASING_OUT] (linked-app ELIMINATE risk); Vehicle Cybersecurity (R155/R156) → Halloran SDV Platform [INVEST, PLANNED] (regulatory cohort risk); Connected Vehicle Services L1 root → no apps mapped (orphaned-tooling risk). Wave heuristic: NOW for the 4 with apps mapped + CRITICAL + INITIAL/DEVELOPING; NEXT for the orphaned Connected Vehicle Services.`,
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
        rubricVersion: CAPABILITY_MATURITY_DEEP_DIVES_RUBRIC_VERSION,
        totalCostUsd: cost,
        fixtures: slice,
      });
      console.log(`[judge] ${SUB_AGENT} subtotal: $${cost.toFixed(3)}`);

      expect(m2).toBeGreaterThan(0);
    }
  );
});
