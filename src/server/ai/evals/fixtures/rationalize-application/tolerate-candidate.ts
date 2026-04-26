import "server-only";
import { db } from "@/server/db";
import { seedWorkspace } from "../_seed";
import type { TextFixture, RationalizeInput } from "../_types";

/** Adequate BV + adequate TH + no replacement available. Per
 *  the TIME rubric this should classify TOLERATE. */
export const TOLERATE_CANDIDATE: TextFixture<RationalizeInput> = {
  name: "tolerate-candidate",
  description:
    "Classify a moderately-valued application with adequate technical health that has no replacement candidate. Expected: TOLERATE.",
  expectedHints:
    "The target app has businessValue=MEDIUM, technicalHealth=FAIR, lifecycle=ACTIVE. No alternatives exist on its capability. No critical risks. TIME rubric maps adequate BV + adequate TH + no cheaper alternative → TOLERATE.",

  async seed() {
    const ws = await seedWorkspace("rationalize_tolerate");

    const cap = await db.businessCapability.create({
      data: {
        workspaceId: ws.workspaceId,
        name: "Internal Reporting",
        level: "L1",
        strategicImportance: "MEDIUM",
      },
    });

    const target = await db.application.create({
      data: {
        workspaceId: ws.workspaceId,
        name: "Finance Reports Tool",
        applicationType: "COTS",
        deploymentModel: "ON_PREMISE",
        lifecycle: "ACTIVE",
        businessValue: "MEDIUM",
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
