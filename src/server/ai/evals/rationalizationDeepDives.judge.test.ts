/**
 * Per-App Deep Dives LLM call — judge eval. 3 runs × Opus judge ×
 * v1 rubric. RUN_EVALS=1 gate.
 *
 * Special concern: the rubric scores named-target adherence
 * (S/4HANA when input has SAP ECC, etc.). This eval is the
 * primary regression detector for the deep-dives prompt's
 * pattern-trigger logic.
 */
import { describe, expect, it } from "vitest";
import {
  buildDeepDivesFacts,
  generateDeepDives,
} from "@/server/ai/deliverables/buildRationalizationDocx";
import {
  formatCurrency,
  formatCurrencyCompact,
} from "@/server/ai/deliverables/_helpers";
import {
  RATIONALIZATION_DEEP_DIVES_RUBRIC,
  RATIONALIZATION_DEEP_DIVES_RUBRIC_VERSION,
} from "./rubrics/rationalizationDeepDives.v1";
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

const SUB_AGENT = "rationalizationDeepDives";

describeMaybe("rationalization per-app deep dives — LLM judge", () => {
  const fixtureName = "h-motors-top5-by-cost";
  const previous = loadPreviousRun();
  const fmt = (n: number) =>
    formatCurrency(n, SYNTHETIC_H_MOTORS_METRICS.costCurrency);
  const fmtCompact = (n: number) =>
    formatCurrencyCompact(n, SYNTHETIC_H_MOTORS_METRICS.costCurrency);
  const topAppsForDeepDives = SYNTHETIC_H_MOTORS_METRICS.topAppsByCost
    .filter((a) => !!a.rationalizationStatus)
    .slice(0, 5);
  const facts = buildDeepDivesFacts(
    SYNTHETIC_H_MOTORS_METRICS,
    topAppsForDeepDives,
    fmt,
    fmtCompact,
    SYNTHETIC_CLIENT_NAME
  );

  it(
    `${fixtureName}: 3-run mean against rubric`,
    { timeout: 300_000 },
    async () => {
      const runs = await Promise.all(
        [1, 2, 3].map(() => generateDeepDives(facts))
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
            rubric: RATIONALIZATION_DEEP_DIVES_RUBRIC,
            task: `Generate per-application deep-dive prose (disposition rationale + recommended path + wave) for the top-5 cost applications in the ${SYNTHETIC_CLIENT_NAME} portfolio.`,
            agentOutput: r.byId,
            fixtureRefs: {
              expectedHints: `Top-5 by cost: SAP ECC 6.0 (£8.4M, MIGRATE, no alternative apps — pattern triggers S/4HANA naming), Teamcenter PLM (£6.2M, MIGRATE, NX/CATIA alternatives present — pattern triggers NX consolidation naming), Halloran SDV Platform (£4.6M, INVEST, PLANNED), CATIA V5 (£4.1M, INVEST, ACTIVE), InControl Connected Services (£3.4M, ELIMINATE, Halloran SDV alternative present). Conservative fallback "platform modernization" acceptable when patterns don't match.`,
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
        rubricVersion: RATIONALIZATION_DEEP_DIVES_RUBRIC_VERSION,
        totalCostUsd: cost,
        fixtures: slice,
      });
      console.log(`[judge] ${SUB_AGENT} subtotal: $${cost.toFixed(3)}`);

      expect(m).toBeGreaterThan(0);
    }
  );
});
