import "server-only";
import { db } from "@/server/db";
import { seedWorkspace } from "../_seed";
import type { TextFixture, RationalizeInput } from "../_types";

/** HIGH BV + POOR TH + no alternatives + a strategic capability +
 *  a known security risk. TIME rubric: high BV + weak TH AND no
 *  replacement → INVEST. */
export const INVEST_CANDIDATE: TextFixture<RationalizeInput> = {
  name: "invest-candidate",
  description:
    "Classify a high-BV, poor-TH critical application that has no replacement available. Expected: INVEST (high BV + weak TH per TIME rubric).",
  expectedHints:
    "The target app has businessValue=HIGH, technicalHealth=POOR, lifecycle=ACTIVE. It is the only app on a CRITICAL-importance capability. There is an open SECURITY risk on it with riskScore≥12. TIME rubric maps high BV + weak TH → INVEST.",

  async seed() {
    const ws = await seedWorkspace("rationalize_invest");

    const cap = await db.businessCapability.create({
      data: {
        workspaceId: ws.workspaceId,
        name: "Customer Identity",
        level: "L1",
        strategicImportance: "CRITICAL",
      },
    });

    const target = await db.application.create({
      data: {
        workspaceId: ws.workspaceId,
        name: "Identity Gateway",
        applicationType: "CUSTOM",
        deploymentModel: "ON_PREMISE",
        lifecycle: "ACTIVE",
        businessValue: "HIGH",
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

    const risk = await db.techRisk.create({
      data: {
        workspaceId: ws.workspaceId,
        title: "Identity Gateway runs unsupported framework",
        description:
          "Identity Gateway is on a framework version past EOL; security patches no longer issued. Affects customer login.",
        category: "SECURITY",
        likelihood: "HIGH",
        impact: "HIGH",
        riskScore: 16,
        status: "OPEN",
      },
    });

    return {
      workspaceId: ws.workspaceId,
      userId: ws.clerkId,
      input: { id: target.id },
      snapshot: {
        applications: [{ id: target.id, name: target.name }],
        capabilities: [{ id: cap.id, name: cap.name, level: "L1" }],
        risks: [{ id: risk.id, title: risk.title }],
      },
      cleanup: ws.cleanup,
    };
  },
};
