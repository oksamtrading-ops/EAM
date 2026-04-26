import "server-only";
import { db } from "@/server/db";
import { seedWorkspace } from "../_seed";
import type { TextFixture, RationalizeInput } from "../_types";

/** Low BV + POOR TH + 2 alternatives on the same capability.
 *  Per the TIME rubric this should classify ELIMINATE
 *  (or MIGRATE if the agent over-weights "viable replacement"). */
export const ELIMINATE_CANDIDATE: TextFixture<RationalizeInput> = {
  name: "eliminate-candidate",
  description:
    "Classify a low-BV, poor-TH legacy application that has 2 healthy alternatives on the same capability. Expected: ELIMINATE (or MIGRATE if the agent emphasises the existing replacement path).",
  expectedHints:
    "The target app has businessValue=LOW, technicalHealth=POOR, lifecycle=PHASING_OUT. Two alternative apps already serve the same capability with healthy lifecycle/health. The TIME rubric maps low BV → ELIMINATE.",

  async seed() {
    const ws = await seedWorkspace("rationalize_eliminate");

    const cap = await db.businessCapability.create({
      data: {
        workspaceId: ws.workspaceId,
        name: "Order Processing",
        level: "L1",
        strategicImportance: "MEDIUM",
      },
    });

    const target = await db.application.create({
      data: {
        workspaceId: ws.workspaceId,
        name: "Legacy Batch Processor",
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

    const altA = await db.application.create({
      data: {
        workspaceId: ws.workspaceId,
        name: "Cloud Order Hub",
        applicationType: "SAAS",
        deploymentModel: "CLOUD_PUBLIC",
        lifecycle: "ACTIVE",
        businessValue: "HIGH",
        technicalHealth: "GOOD",
        capabilities: {
          create: {
            workspaceId: ws.workspaceId,
            capabilityId: cap.id,
            relationshipType: "SUPPORTING",
          },
        },
      },
    });

    const altB = await db.application.create({
      data: {
        workspaceId: ws.workspaceId,
        name: "Modern Order Service",
        applicationType: "CUSTOM",
        deploymentModel: "CLOUD_PUBLIC",
        lifecycle: "ACTIVE",
        businessValue: "HIGH",
        technicalHealth: "EXCELLENT",
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
          { id: altA.id, name: altA.name },
          { id: altB.id, name: altB.name },
        ],
        capabilities: [{ id: cap.id, name: cap.name, level: "L1" }],
      },
      cleanup: ws.cleanup,
    };
  },
};
