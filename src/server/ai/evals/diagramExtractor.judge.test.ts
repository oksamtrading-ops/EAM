/**
 * Diagram extractor — LLM-as-judge eval.
 *
 * For each fixture under `fixtures/diagram-extractor/`, runs the
 * extractor 3× (production temperature, absorbs sampling noise),
 * scores each run with Opus 4.6 against the rubric at
 * `rubrics/diagramExtractor.v1.ts`, logs mean + stdev, prints
 * failure exemplars for low scores, and writes the archive slice
 * to `results/last-run.json` (schema v2; nests under sub-agent
 * name so re-running one judge file doesn't clobber others).
 *
 * v1 ships with a smoke assertion (avgScore > 0). After 5-10 runs
 * the empirical baseline reveals the right threshold; tighten then.
 *
 * Gated behind RUN_EVALS=1 — calls live Anthropic for both the
 * agent and the judge.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { extractFromImage } from "@/server/ai/services/intakeExtraction";
import { judgeOutput, type JudgeResult } from "./_judge";
import {
  DIAGRAM_EXTRACTOR_RUBRIC,
  DIAGRAM_EXTRACTOR_RUBRIC_VERSION,
} from "./rubrics/diagramExtractor.v1";
import {
  diffSlice,
  loadPreviousRun,
  writeArchiveSlice,
  type FixtureScore,
} from "./_judgeArchive";
import { mean, stdDev } from "./_stats";

const RUN = process.env.RUN_EVALS === "1";
const describeMaybe = RUN ? describe : describe.skip;

const SUB_AGENT = "diagramExtractor";

const FIXTURE_DIR = path.resolve(
  process.cwd(),
  "src/server/ai/evals/fixtures/diagram-extractor"
);

const FIXTURES = [
  "prod-upload-001",
  "synthetic-minimal",
  "low-quality-edge",
] as const;

type FixtureMeta = {
  name: string;
  description: string;
  expectedHints?: string;
};

type LocalFixtureResult = {
  name: string;
  meanScore: number;
  stdDev: number;
  scores: JudgeResult[];
  costUsd: number;
};

function loadFixture(name: string): {
  meta: FixtureMeta;
  bytes: Buffer;
} | null {
  const pngPath = path.join(FIXTURE_DIR, `${name}.png`);
  const metaPath = path.join(FIXTURE_DIR, `${name}.json`);
  if (!existsSync(pngPath)) {
    console.log(
      `[judge] fixture missing: ${pngPath} — drop a PNG to enable this test (see README in the fixture dir)`
    );
    return null;
  }
  if (!existsSync(metaPath)) {
    console.log(`[judge] metadata missing: ${metaPath}`);
    return null;
  }
  const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as FixtureMeta;
  const bytes = readFileSync(pngPath);
  return { meta, bytes };
}

describeMaybe("diagram extractor — LLM judge", () => {
  const fixtureResults: LocalFixtureResult[] = [];
  const previous = loadPreviousRun();

  for (const fixtureName of FIXTURES) {
    it(
      `${fixtureName}: agent + judge`,
      { timeout: 180_000 },
      async () => {
        const fx = loadFixture(fixtureName);
        if (!fx) return;

        const agentRuns = await Promise.all([1, 2, 3].map(() =>
          extractFromImage(fx.bytes, "image/png", `${fixtureName}.png`)
        ));

        const judgments = await Promise.all(
          agentRuns.map((output) =>
            judgeOutput({
              rubric: DIAGRAM_EXTRACTOR_RUBRIC,
              task: fx.meta.description,
              agentOutput: output,
              fixtureRefs: {
                sourceImageBase64: fx.bytes.toString("base64"),
                sourceImageMimeType: "image/png",
                expectedHints: fx.meta.expectedHints,
              },
            })
          )
        );

        const scores = judgments.map((j) => j.avgScore);
        const m = mean(scores);
        const sd = stdDev(scores);
        const cost = judgments.reduce((a, j) => a + j.costUsd, 0);

        fixtureResults.push({
          name: fixtureName,
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
      }
    );
  }

  it("write archive slice + total cost", () => {
    if (fixtureResults.length === 0) {
      console.log(
        `[judge] no diagram fixtures ran (PNGs missing). See ${FIXTURE_DIR}/README.md`
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
      rubricVersion: DIAGRAM_EXTRACTOR_RUBRIC_VERSION,
      totalCostUsd: totalCost,
      fixtures: slice,
    });

    console.log(
      `[judge] ${SUB_AGENT} subtotal: $${totalCost.toFixed(3)}`
    );
  });
});
