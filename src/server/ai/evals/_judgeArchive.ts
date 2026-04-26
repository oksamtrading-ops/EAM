import "server-only";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { JUDGE_MODEL } from "./_judge";

/**
 * Run-over-run archive for the judge harness. Schema v2 nests
 * results under sub-agent name so multiple judge test files can
 * accumulate without overwriting each other.
 *
 * Concurrency: vitest runs test files in worker processes in
 * parallel by default. The npm `evals` script must pass
 * `--no-file-parallelism` so the read-modify-write here is safe.
 */

export const ARCHIVE_SCHEMA_VERSION = 2;

const RESULTS_DIR = path.resolve(
  process.cwd(),
  "src/server/ai/evals/results"
);
const LAST_RUN_PATH = path.join(RESULTS_DIR, "last-run.json");

export type FixtureScore = {
  name: string;
  meanScore: number;
  stdDev: number;
};

export type SubAgentSlice = {
  rubricVersion: string;
  totalCostUsd: number;
  fixtures: FixtureScore[];
};

export type Archive = {
  schemaVersion: number;
  ranAt: string;
  judgeModel: string;
  totalCostUsd: number;
  subAgents: Record<string, SubAgentSlice>;
};

export function loadPreviousRun(): Archive | null {
  if (!existsSync(LAST_RUN_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(LAST_RUN_PATH, "utf-8")) as Archive;
    // v1 archives lack schemaVersion or use a different shape.
    // Treat as missing → next write rebuilds cleanly. No migrator.
    if (parsed.schemaVersion !== ARCHIVE_SCHEMA_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Read-modify-write a single sub-agent slice. Other slices are
 * preserved so re-running one judge test file (e.g. `vitest run
 * rationalizeApp.judge`) doesn't clobber the others.
 *
 * Recomputes top-level totalCostUsd from the union of slices.
 */
export function writeArchiveSlice(
  subAgentName: string,
  slice: SubAgentSlice
): void {
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const existing = loadPreviousRun();
  const archive: Archive = existing ?? {
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    ranAt: new Date().toISOString(),
    judgeModel: JUDGE_MODEL,
    totalCostUsd: 0,
    subAgents: {},
  };

  archive.subAgents[subAgentName] = slice;
  archive.ranAt = new Date().toISOString();
  archive.judgeModel = JUDGE_MODEL;
  archive.totalCostUsd = Object.values(archive.subAgents).reduce(
    (sum, s) => sum + s.totalCostUsd,
    0
  );

  writeFileSync(LAST_RUN_PATH, JSON.stringify(archive, null, 2) + "\n");
}

/** Print a per-fixture diff vs the previous run for one sub-agent. */
export function diffSlice(
  subAgentName: string,
  current: FixtureScore[],
  previous: Archive | null
): void {
  const prevSlice = previous?.subAgents[subAgentName];
  for (const fx of current) {
    const prev = prevSlice?.fixtures.find((f) => f.name === fx.name);
    if (!prev) {
      console.log(
        `[judge] ${subAgentName}/${fx.name}: ${fx.meanScore.toFixed(1)} ± ${fx.stdDev.toFixed(2)}  (new)`
      );
      continue;
    }
    const delta = fx.meanScore - prev.meanScore;
    const arrow =
      Math.abs(delta) < 0.05 ? "±0" : delta > 0 ? `Δ +${delta.toFixed(1)}` : `Δ ${delta.toFixed(1)}`;
    console.log(
      `[judge] ${subAgentName}/${fx.name}: ${fx.meanScore.toFixed(1)} ± ${fx.stdDev.toFixed(2)} (was ${prev.meanScore.toFixed(1)} → ${arrow})`
    );
  }
}

export const ARCHIVE_PATH = LAST_RUN_PATH;
