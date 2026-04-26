import "server-only";
import { db } from "@/server/db";
import { seedWorkspace } from "../_seed";
import type { TextFixture, ImpactAnalysisInput } from "../_types";

/** Target app + exactly one alternative on a HIGH-importance cap.
 *  Per the rubric: 1 alternative → PARTIALLY_COVERED; HIGH cap with
 *  only 1 alternative → overallRiskLevel HIGH. */
export const PARTIAL_COVERAGE: TextFixture<ImpactAnalysisInput> = {
  name: "partial-coverage",
  description:
    "Assess retirement impact when the target app's HIGH-importance capability has exactly one alternative app. Expected: overallRiskLevel=HIGH, PARTIALLY_COVERED, the single alternative listed.",
  expectedHints:
    "The target app shares a HIGH-importance capability with exactly ONE other app. Per the agent's rubric: exactly 1 alternative → PARTIALLY_COVERED; HIGH cap with only 1 alternative → overallRiskLevel HIGH.",

  async seed() {
    const ws = await seedWorkspace("impact_partial_coverage");

    const cap = await db.businessCapability.create({
      data: {
        workspaceId: ws.workspaceId,
        name: "Payments Processing",
        level: "L1",
        strategicImportance: "HIGH",
      },
    });

    const target = await db.application.create({
      data: {
        workspaceId: ws.workspaceId,
        name: "PayCore",
        applicationType: "CUSTOM",
        deploymentModel: "ON_PREMISE",
        lifecycle: "ACTIVE",
        businessValue: "HIGH",
        technicalHealth: "FAIR",
        capabilities: {
          create: {
            workspaceId: ws.workspaceId,
            capabilityId: cap.id,
            relationshipType: "PRIMARY",
          },
        },
      },
    });

    const alt = await db.application.create({
      data: {
        workspaceId: ws.workspaceId,
        name: "Stripe Adapter",
        applicationType: "SAAS",
        deploymentModel: "CLOUD_PUBLIC",
        lifecycle: "ACTIVE",
        businessValue: "MEDIUM",
        technicalHealth: "FAIR",
        capabilities: {
          create: {
            workspaceId: ws.workspaceId,
            capabilityId: cap.id,
            relationshipType: "SUPPORTING",
          },
        },
      },
    });

    return {
      workspaceId: ws.workspaceId,
      userId: ws.clerkId,
      input: { id: target.id },
      snapshot: {
        applications: [
          { id: target.id, name: target.name },
          { id: alt.id, name: alt.name },
        ],
        capabilities: [{ id: cap.id, name: cap.name, level: "L1" }],
      },
      cleanup: ws.cleanup,
    };
  },
};
