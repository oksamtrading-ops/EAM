/**
 * Rationalization critic eval.
 *
 * Feeds deliberately-wrong classifications to evaluateRationalization
 * and asserts the critic catches each contradiction. Gated behind
 * RUN_EVALS=1.
 */
import { afterAll, describe, expect, it } from "vitest";
import {
  evaluateRationalization,
  type AppSummary,
  type RationalizationSingle,
} from "@/server/ai/services/rationalizationEvaluator";
import { db } from "@/server/db";

const RUN = process.env.RUN_EVALS === "1";
const describeMaybe = RUN ? describe : describe.skip;

type Case = {
  label: string;
  app: AppSummary;
  initial: RationalizationSingle;
  /** We expect the critic to revise to one of these classifications. */
  expectRevisedTo: Array<RationalizationSingle["classification"]>;
};

const CASES: Case[] = [
  {
    label: "high-BV + poor-TH misclassified as TOLERATE",
    app: {
      name: "Core Banking Platform",
      vendor: "Legacy Bank Systems",
      lifecycle: "ACTIVE",
      businessValue: "CRITICAL",
      technicalHealth: "POOR",
      functionalFit: "GOOD",
      annualCostUsd: 2_400_000,
      integrationCount: 18,
    },
    initial: {
      classification: "TOLERATE",
      rationale:
        "Business-critical and still works fine — no action needed.",
      confidence: "MEDIUM",
    },
    // Critical BV + poor TH is textbook INVEST or MIGRATE, not TOLERATE.
    expectRevisedTo: ["INVEST", "MIGRATE"],
  },
  {
    label: "already-retired app misclassified as INVEST",
    app: {
      name: "Sunsetted Reporting Portal",
      vendor: "In-house",
      lifecycle: "RETIRED",
      businessValue: "LOW",
      technicalHealth: "POOR",
      functionalFit: "POOR",
      annualCostUsd: 0,
    },
    initial: {
      classification: "INVEST",
      rationale: "Let's invest more into this legacy reporting tool.",
      confidence: "HIGH",
    },
    // RETIRED with LOW BV should become ELIMINATE.
    expectRevisedTo: ["ELIMINATE"],
  },
];

describeMaybe("rationalization critic — catches contradictions", () => {
  const workspaceIds: string[] = [];

  afterAll(async () => {
    // Clean up seeded workspaces + their AgentRuns.
    for (const wsId of workspaceIds) {
      await db.agentRun.deleteMany({ where: { workspaceId: wsId } }).catch(() => {});
      await db.workspace.delete({ where: { id: wsId } }).catch(() => {});
    }
    await db.$disconnect();
  });

  async function seedWorkspace() {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const user = await db.user.create({
      data: {
        clerkId: `eval_critic_${suffix}`,
        email: `eval_critic_${suffix}@evals.test`,
        name: "Eval Critic",
      },
    });
    const workspace = await db.workspace.create({
      data: {
        userId: user.id,
        slug: `eval-critic-${suffix}`,
        name: `Eval Critic ${suffix}`,
        industry: "GENERIC",
        isDefault: false,
      },
    });
    workspaceIds.push(workspace.id);
    return { workspaceId: workspace.id, userId: user.id };
  }

  for (const c of CASES) {
    it(c.label, async () => {
      const { workspaceId } = await seedWorkspace();
      const result = await evaluateRationalization({
        workspaceId,
        app: c.app,
        initial: c.initial,
      });

      // The critic must surface the contradiction — either by revising
      // the classification or by rejecting with verdict=REVISE on first
      // pass (which forces the regenerator to propose a new one).
      expect(result.history.length).toBeGreaterThan(0);
      const firstCritic = result.history[0]!.critic;

      const revised =
        result.final.classification !== c.initial.classification;
      const rejectedInitial = firstCritic.verdict === "REVISE";

      expect(
        revised || rejectedInitial,
        `Critic accepted a bad classification for "${c.label}". ` +
          `Final: ${result.final.classification} (initial was ${c.initial.classification}). ` +
          `First-pass verdict: ${firstCritic.verdict} (score ${firstCritic.score}).`
      ).toBe(true);

      if (revised) {
        expect(
          c.expectRevisedTo.includes(result.final.classification),
          `Expected revision to one of [${c.expectRevisedTo.join(", ")}], got ${result.final.classification}`
        ).toBe(true);
      }
    });
  }
});
