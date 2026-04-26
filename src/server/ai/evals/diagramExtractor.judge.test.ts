/**
 * Diagram extractor — LLM-as-judge eval.
 *
 * For each fixture under `fixtures/diagram-extractor/`, runs the
 * extractor 3× (production temperature, absorbs sampling noise),
 * scores each run with Opus 4.6 against the rubric at
 * `rubrics/diagramExtractor.v1.ts`, logs mean + stdev, prints
 * failure exemplars for low scores, and writes the results to
 * `results/last-run.json` so the next run can diff scores.
 *
 * v1 ships with a smoke assertion (avgScore > 0). After 5–10 runs
 * the empirical baseline reveals the right threshold; tighten then.
 *
 * Gated behind RUN_EVALS=1 — calls live Anthropic for both the
 * agent and the judge.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { extractFromImage } from "@/server/ai/services/intakeExtraction";
import { judgeOutput, JUDGE_MODEL, type JudgeResult } from "./_judge";
import { DIAGRAM_EXTRACTOR_RUBRIC } from "./rubrics/diagramExtractor.v1";

const RUN = process.env.RUN_EVALS === "1";
const describeMaybe = RUN ? describe : describe.skip;

const FIXTURE_DIR = path.resolve(
  process.cwd(),
  "src/server/ai/evals/fixtures/diagram-extractor"
);
const RESULTS_DIR = path.resolve(
  process.cwd(),
  "src/server/ai/evals/results"
);
const LAST_RUN_PATH = path.join(RESULTS_DIR, "last-run.json");

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

type FixtureResult = {
  name: string;
  meanScore: number;
  stdDev: number;
  scores: JudgeResult[];
  costUsd: number;
};

type RunArchive = {
  ranAt: string;
  judgeModel: string;
  totalCostUsd: number;
  fixtures: Array<{
    name: string;
    meanScore: number;
    stdDev: number;
  }>;
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

function loadPreviousRun(): RunArchive | null {
  if (!existsSync(LAST_RUN_PATH)) return null;
  try {
    return JSON.parse(readFileSync(LAST_RUN_PATH, "utf-8")) as RunArchive;
  } catch {
    return null;
  }
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance =
    xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

describeMaybe("diagram extractor — LLM judge", () => {
  const fixtureResults: FixtureResult[] = [];

  // Print run-over-run diff once at the start.
  const previous = loadPreviousRun();

  for (const fixtureName of FIXTURES) {
    it(
      `${fixtureName}: agent + judge`,
      { timeout: 180_000 },
      async () => {
        const fx = loadFixture(fixtureName);
        if (!fx) {
          // Fixture PNG isn't present — skip cleanly without failing.
          // Once a PNG is added the next run picks it up.
          return;
        }

        // 3× agent runs at production temperature to absorb sampling
        // noise. Judge stays at temperature 0.
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

        // Console summary
        const prevEntry = previous?.fixtures.find(
          (f) => f.name === fixtureName
        );
        const delta = prevEntry
          ? ` (was ${prevEntry.meanScore.toFixed(1)} → Δ ${(m - prevEntry.meanScore).toFixed(1)})`
          : "";
        console.log(
          `[judge] ${fixtureName}: ${m.toFixed(1)} ± ${sd.toFixed(2)}${delta}  cost=$${cost.toFixed(3)}`
        );

        // Failure exemplar dump for low scores
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

        // Smoke assertion only — never fail the suite. Threshold
        // tightens after 5–10 runs reveal the empirical baseline.
        expect(m).toBeGreaterThan(0);
      }
    );
  }

  // After all fixtures, write the archive. Vitest doesn't run an
  // afterAll hook with results visible to it, so we attach this to
  // the last fixture's `it`.
  it("write results archive + total cost", () => {
    if (fixtureResults.length === 0) {
      console.log(
        `[judge] no fixtures ran (PNGs missing). See ${FIXTURE_DIR}/README.md`
      );
      return;
    }

    if (!existsSync(RESULTS_DIR)) {
      mkdirSync(RESULTS_DIR, { recursive: true });
    }

    const totalCost = fixtureResults.reduce((a, f) => a + f.costUsd, 0);

    const archive: RunArchive = {
      ranAt: new Date().toISOString(),
      judgeModel: JUDGE_MODEL,
      totalCostUsd: totalCost,
      fixtures: fixtureResults.map((f) => ({
        name: f.name,
        meanScore: f.meanScore,
        stdDev: f.stdDev,
      })),
    };

    writeFileSync(LAST_RUN_PATH, JSON.stringify(archive, null, 2) + "\n");

    console.log(`[judge] suite total: $${totalCost.toFixed(3)}`);
    console.log(`[judge] archive written: ${LAST_RUN_PATH}`);
  });
});
