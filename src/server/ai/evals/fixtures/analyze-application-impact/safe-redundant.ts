import "server-only";
import { db } from "@/server/db";
import { seedWorkspace } from "../_seed";
import type { TextFixture, ImpactAnalysisInput } from "../_types";

/** Target app supports a non-critical capability with 3 alternative
 *  apps. ≥2 alternatives → FULLY_COVERED. All alternatives healthy →
 *  overallRiskLevel LOW. */
export const SAFE_REDUNDANT: TextFixture<ImpactAnalysisInput> = {
  name: "safe-redundant",
  description:
    "Assess retirement impact when the target app's capability is fully covered by 3 healthy alternatives. Expected: overallRiskLevel=LOW, FULLY_COVERED, alternatives populated.",
  expectedHints:
    "The target app shares a MEDIUM-importance capability with 3 other healthy alternatives. Per the agent's rubric: ≥2 alternatives → FULLY_COVERED; all FULLY_COVERED → overallRiskLevel LOW.",

  async seed() {
    const ws = await seedWorkspace("impact_safe_redundant");

    const cap = await db.businessCapability.create({
      data: {
        workspaceId: ws.workspaceId,
        name: "Internal Notifications",
        level: "L1",
        strategicImportance: "MEDIUM",
      },
    });

    const target = await db.application.create({
      data: {
        workspaceId: ws.workspaceId,
        name: "LegacyMailer",
        applicationType: "LEGACY",
        deploymentModel: "ON_PREMISE",
        lifecycle: "PHASING_OUT",
        businessValue: "LOW",
        technicalHealth: "POOR",
        capabilities: {
          create: {
            workspaceId: ws.workspaceId,
            capabilityId: cap.id,
            relationshipType: "PRIMARY",
          },
        },
      },
    });

    const alts = await Promise.all([
      db.application.create({
        data: {
          workspaceId: ws.workspaceId,
          name: "SendGrid",
          applicationType: "SAAS",
          deploymentModel: "CLOUD_PUBLIC",
          lifecycle: "ACTIVE",
          businessValue: "MEDIUM",
          technicalHealth: "GOOD",
          capabilities: {
            create: {
              workspaceId: ws.workspaceId,
              capabilityId: cap.id,
              relationshipType: "SUPPORTING",
            },
          },
        },
      }),
      db.application.create({
        data: {
          workspaceId: ws.workspaceId,
          name: "Postmark",
          applicationType: "SAAS",
          deploymentModel: "CLOUD_PUBLIC",
          lifecycle: "ACTIVE",
          businessValue: "MEDIUM",
          technicalHealth: "GOOD",
          capabilities: {
            create: {
              workspaceId: ws.workspaceId,
              capabilityId: cap.id,
              relationshipType: "SUPPORTING",
            },
          },
        },
      }),
      db.application.create({
        data: {
          workspaceId: ws.workspaceId,
          name: "Internal Notifier",
          applicationType: "CUSTOM",
          deploymentModel: "CLOUD_PRIVATE",
          lifecycle: "ACTIVE",
          businessValue: "MEDIUM",
          technicalHealth: "EXCELLENT",
          capabilities: {
            create: {
              workspaceId: ws.workspaceId,
              capabilityId: cap.id,
              relationshipType: "SUPPORTING",
            },
          },
        },
      }),
    ]);

    return {
      workspaceId: ws.workspaceId,
      userId: ws.clerkId,
      input: { id: target.id },
      snapshot: {
        applications: [
          { id: target.id, name: target.name },
          ...alts.map((a) => ({ id: a.id, name: a.name })),
        ],
        capabilities: [{ id: cap.id, name: cap.name, level: "L1" }],
      },
      cleanup: ws.cleanup,
    };
  },
};
