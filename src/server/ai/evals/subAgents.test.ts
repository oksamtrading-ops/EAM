/**
 * Sub-agent evals — rationalize_application, analyze_application_impact,
 * capability_coverage_report.
 *
 * Seeds a small but realistic workspace (apps + capabilities + a risk),
 * invokes each sub-agent via runSubAgent, and asserts the structured
 * JSON output matches the agreed shape and references the seeded
 * entities. Gated on RUN_EVALS=1 because each call hits Anthropic.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { runSubAgent } from "@/server/ai/subAgents";

const RUN = process.env.RUN_EVALS === "1";
const describeMaybe = RUN ? describe : describe.skip;

type Seed = {
  workspaceId: string;
  clerkId: string;
  retireApp: string;
  keepApp: string;
  coreCapId: string;
  orphanCapId: string;
  cleanup: () => Promise<void>;
};

async function seed(): Promise<Seed> {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const clerkId = `eval_subagent_${suffix}`;
  const user = await db.user.create({
    data: {
      clerkId,
      email: `${clerkId}@evals.test`,
      name: "Eval Sub-agent",
    },
  });
  const workspace = await db.workspace.create({
    data: {
      userId: user.id,
      slug: `eval-sub-${suffix}`,
      name: `Eval Sub-agent ${suffix}`,
      industry: "GENERIC",
      isDefault: false,
    },
  });

  // Two capabilities: one covered by both apps, one orphaned (critical).
  const coreCap = await db.businessCapability.create({
    data: {
      workspaceId: workspace.id,
      name: "Core Processing",
      level: "L1",
      strategicImportance: "HIGH",
    },
  });
  const orphanCap = await db.businessCapability.create({
    data: {
      workspaceId: workspace.id,
      name: "Unsupported Analytics",
      level: "L1",
      strategicImportance: "CRITICAL",
    },
  });

  // One retire-candidate app: PHASING_OUT, POOR health, LOW value.
  const retire = await db.application.create({
    data: {
      workspaceId: workspace.id,
      name: "Legacy Processor",
      applicationType: "LEGACY",
      deploymentModel: "ON_PREMISE",
      lifecycle: "PHASING_OUT",
      businessValue: "LOW",
      technicalHealth: "POOR",
      rationalizationStatus: "ELIMINATE",
      capabilities: {
        create: {
          workspaceId: workspace.id,
          capabilityId: coreCap.id,
          relationshipType: "PRIMARY",
        },
      },
    },
  });

  // One healthy app on the same capability — provides an alternative for impact analysis.
  const keep = await db.application.create({
    data: {
      workspaceId: workspace.id,
      name: "Modern Processor",
      applicationType: "SAAS",
      deploymentModel: "CLOUD_PUBLIC",
      lifecycle: "ACTIVE",
      businessValue: "HIGH",
      technicalHealth: "GOOD",
      rationalizationStatus: "INVEST",
      capabilities: {
        create: {
          workspaceId: workspace.id,
          capabilityId: coreCap.id,
          relationshipType: "SUPPORTING",
        },
      },
    },
  });

  const cleanup = async () => {
    await db.applicationCapabilityMap
      .deleteMany({ where: { application: { workspaceId: workspace.id } } })
      .catch(() => {});
    await db.application
      .deleteMany({ where: { workspaceId: workspace.id } })
      .catch(() => {});
    await db.businessCapability
      .deleteMany({ where: { workspaceId: workspace.id } })
      .catch(() => {});
    await db.agentRun
      .deleteMany({ where: { workspaceId: workspace.id } })
      .catch(() => {});
    await db.workspace.delete({ where: { id: workspace.id } }).catch(() => {});
    await db.user.delete({ where: { id: user.id } }).catch(() => {});
  };

  return {
    workspaceId: workspace.id,
    clerkId,
    retireApp: retire.id,
    keepApp: keep.id,
    coreCapId: coreCap.id,
    orphanCapId: orphanCap.id,
    cleanup,
  };
}

describeMaybe("sub-agent evals", () => {
  let s: Seed;

  beforeAll(async () => {
    s = await seed();
  });

  afterAll(async () => {
    await s?.cleanup();
    await db.$disconnect();
  });

  it("rationalize_application returns a TIME classification grounded in the app", async () => {
    const res = await runSubAgent(
      "rationalize_application",
      { id: s.retireApp },
      {
        workspaceId: s.workspaceId,
        userId: s.clerkId,
        subAgentCallsSoFar: 0,
        subAgentBudget: 3,
      }
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const out = res.result as Record<string, unknown>;
    expect(["TOLERATE", "INVEST", "MIGRATE", "ELIMINATE"]).toContain(
      out.classification
    );
    // Low BV + poor TH + phasing-out → should lean ELIMINATE / MIGRATE.
    expect(["ELIMINATE", "MIGRATE"]).toContain(out.classification);
    expect(typeof out.rationale).toBe("string");
    expect(Array.isArray(out.evidence)).toBe(true);
  });

  it("analyze_application_impact identifies the covered capability's alternative", async () => {
    const res = await runSubAgent(
      "analyze_application_impact",
      { id: s.retireApp },
      {
        workspaceId: s.workspaceId,
        userId: s.clerkId,
        subAgentCallsSoFar: 0,
        subAgentBudget: 3,
      }
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const out = res.result as Record<string, unknown>;
    expect(["CRITICAL", "HIGH", "MODERATE", "LOW"]).toContain(
      out.overallRiskLevel
    );
    const affected = (out.affectedCapabilities ?? []) as Array<{
      name: string;
      coverageAfterRetirement: string;
      alternatives: string[];
    }>;
    const core = affected.find((c) =>
      c.name.toLowerCase().includes("core processing")
    );
    expect(core, "Expected Core Processing in affectedCapabilities").toBeTruthy();
    if (core) {
      // Modern Processor also serves this cap → should NOT be uncovered.
      expect(core.coverageAfterRetirement).not.toBe("UNCOVERED");
      expect(
        core.alternatives.some((a) =>
          a.toLowerCase().includes("modern processor")
        )
      ).toBe(true);
    }
  });

  it("capability_coverage_report flags the unserved critical capability", async () => {
    const res = await runSubAgent(
      "capability_coverage_report",
      {},
      {
        workspaceId: s.workspaceId,
        userId: s.clerkId,
        subAgentCallsSoFar: 0,
        subAgentBudget: 3,
      }
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const out = res.result as Record<string, unknown>;
    const totals = (out.totals ?? {}) as Record<string, number>;
    expect(typeof totals.unserved).toBe("number");
    expect(totals.unserved).toBeGreaterThanOrEqual(1);
    const unservedCritical = (out.unservedCritical ?? []) as string[];
    expect(
      unservedCritical.some((n) =>
        n.toLowerCase().includes("unsupported analytics")
      ),
      `Expected "Unsupported Analytics" in unservedCritical. Got: ${unservedCritical.join(", ")}`
    ).toBe(true);
  });

  it("enforces the sub-agent budget", async () => {
    const res = await runSubAgent(
      "capability_coverage_report",
      {},
      {
        workspaceId: s.workspaceId,
        userId: s.clerkId,
        subAgentCallsSoFar: 3,
        subAgentBudget: 3,
      }
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/budget/i);
  });
});
