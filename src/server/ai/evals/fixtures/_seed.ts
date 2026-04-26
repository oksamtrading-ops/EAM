import "server-only";
import { db } from "@/server/db";

/** Shared user + workspace seed used by every text-fixture seed().
 *  Returns the IDs and a cleanup function that handles user +
 *  workspace teardown (cascades to apps/caps/risks/AgentRuns/Steps
 *  via Prisma schema relations + the explicit deleteMany calls
 *  callers chain in their own cleanup). */
export async function seedWorkspace(prefix: string): Promise<{
  workspaceId: string;
  userId: string;
  clerkId: string;
  cleanup: () => Promise<void>;
}> {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const clerkId = `${prefix}_${suffix}`;
  const user = await db.user.create({
    data: {
      clerkId,
      email: `${clerkId}@evals.test`,
      name: `Eval ${prefix}`,
    },
  });
  const workspace = await db.workspace.create({
    data: {
      userId: user.id,
      slug: `eval-${prefix}-${suffix}`.slice(0, 60),
      name: `Eval ${prefix} ${suffix}`,
      industry: "GENERIC",
      isDefault: false,
    },
  });

  const cleanup = async () => {
    await db.applicationCapabilityMap
      .deleteMany({ where: { application: { workspaceId: workspace.id } } })
      .catch(() => {});
    await db.application
      .deleteMany({ where: { workspaceId: workspace.id } })
      .catch(() => {});
    await db.techRisk
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
    userId: user.id,
    clerkId,
    cleanup,
  };
}
