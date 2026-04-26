import "server-only";
import { db } from "@/server/db";
import { seedWorkspace } from "../_seed";
import type { TextFixture, ImpactAnalysisInput } from "../_types";

/** Target app uniquely supports a CRITICAL capability — no alternatives.
 *  Per the rubric: 0 alternatives → UNCOVERED, CRITICAL importance →
 *  overallRiskLevel CRITICAL. */
export const CRITICAL_UNCOVERED: TextFixture<ImpactAnalysisInput> = {
  name: "critical-uncovered",
  description:
    "Assess retirement impact when the target app uniquely supports a CRITICAL-importance capability. Expected: overallRiskLevel=CRITICAL, the capability is UNCOVERED, no alternatives.",
  expectedHints:
    "The target app is the SOLE app on a CRITICAL-importance capability. There are no other apps in the workspace. Per the agent's rubric: 0 alternatives → UNCOVERED; CRITICAL cap UNCOVERED → overallRiskLevel CRITICAL.",

  async seed() {
    const ws = await seedWorkspace("impact_critical_uncovered");

    const cap = await db.businessCapability.create({
      data: {
        workspaceId: ws.workspaceId,
        name: "Regulatory Submissions",
        level: "L1",
        strategicImportance: "CRITICAL",
      },
    });

    const target = await db.application.create({
      data: {
        workspaceId: ws.workspaceId,
        name: "RegSub Engine",
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

    return {
      workspaceId: ws.workspaceId,
      userId: ws.clerkId,
      input: { id: target.id },
      snapshot: {
        applications: [{ id: target.id, name: target.name }],
        capabilities: [{ id: cap.id, name: cap.name, level: "L1" }],
      },
      cleanup: ws.cleanup,
    };
  },
};
