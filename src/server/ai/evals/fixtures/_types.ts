import "server-only";
import type { WorkspaceSnapshot } from "../_judge";

/**
 * Shared fixture contract for text-driven sub-agent evals. Each
 * fixture seeds an ephemeral workspace + entities (cleaned up
 * after the test) and exposes the input the sub-agent receives.
 *
 * Each fixture's seed() must:
 *   1. create a fresh user + workspace with unique suffix
 *      (mirrors src/server/ai/evals/subAgents.test.ts:27-122)
 *   2. seed the apps/caps/risks the agent will see
 *   3. return cleanup that cascades through AgentRun → Step
 *   4. return a structured snapshot the judge uses for ID-grounding
 */

export type TextFixtureSeed<TInput> = {
  workspaceId: string;
  /** Clerk-style ID we created for the test user. */
  userId: string;
  input: TInput;
  snapshot: WorkspaceSnapshot;
  cleanup: () => Promise<void>;
};

export type TextFixture<TInput> = {
  name: string;
  description: string;
  expectedHints?: string;
  seed: () => Promise<TextFixtureSeed<TInput>>;
};

export type RationalizeInput = { id: string };
export type ImpactAnalysisInput = { id: string };
