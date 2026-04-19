/**
 * Tool-executor isolation test.
 *
 * Verifies the security invariant: a tool call bound to workspace A
 * cannot observe data that belongs to workspace B, even if the model
 * attempts to pass a different workspaceId in its input arguments.
 *
 * This test does NOT call Anthropic. It's fast, deterministic, and
 * safe to run on every commit (no RUN_EVALS guard).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { buildAgentCaller, executeTool } from "@/server/ai/tools";

type Cleanup = () => Promise<void>;

async function seedWorkspace(label: string): Promise<{
  workspaceId: string;
  clerkId: string;
  appId: string;
  cleanup: Cleanup;
}> {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const clerkId = `eval_${label}_${suffix}`;
  const user = await db.user.create({
    data: {
      clerkId,
      email: `${clerkId}@evals.test`,
      name: `Eval ${label}`,
    },
    select: { id: true },
  });
  const workspace = await db.workspace.create({
    data: {
      userId: user.id,
      slug: `eval-${label}-${suffix}`,
      name: `Eval ${label} ${suffix}`,
      industry: "GENERIC",
      isDefault: false,
    },
    select: { id: true },
  });
  const app = await db.application.create({
    data: {
      workspaceId: workspace.id,
      name: `Secret ${label} App ${suffix}`,
      applicationType: "CUSTOM",
      deploymentModel: "UNKNOWN",
      lifecycle: "ACTIVE",
      businessValue: "BV_UNKNOWN",
      technicalHealth: "TH_UNKNOWN",
      rationalizationStatus: "RAT_NOT_ASSESSED",
    },
    select: { id: true },
  });

  const cleanup: Cleanup = async () => {
    await db.application
      .deleteMany({ where: { workspaceId: workspace.id } })
      .catch(() => {});
    await db.workspace.delete({ where: { id: workspace.id } }).catch(() => {});
    await db.user.delete({ where: { id: user.id } }).catch(() => {});
  };

  return {
    workspaceId: workspace.id,
    clerkId,
    appId: app.id,
    cleanup,
  };
}

describe("tool executor — workspace isolation", () => {
  let a: Awaited<ReturnType<typeof seedWorkspace>>;
  let b: Awaited<ReturnType<typeof seedWorkspace>>;

  beforeAll(async () => {
    a = await seedWorkspace("A");
    b = await seedWorkspace("B");
  });

  afterAll(async () => {
    await a?.cleanup();
    await b?.cleanup();
    await db.$disconnect();
  });

  it("list_applications returns only the caller's workspace apps", async () => {
    const caller = buildAgentCaller({
      userId: a.clerkId,
      workspaceId: a.workspaceId,
    });
    const result = await executeTool(caller, "list_applications", {}, {
      workspaceId: a.workspaceId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const apps = result.output as Array<{ id: string; name: string }>;
    const ids = apps.map((x) => x.id);
    expect(ids).toContain(a.appId);
    expect(ids).not.toContain(b.appId);
  });

  it("strips workspaceId injected by model input", async () => {
    // Model tries to redirect the tool to workspace B by passing workspaceId.
    // The executor must strip that key before invoking the tRPC caller.
    const caller = buildAgentCaller({
      userId: a.clerkId,
      workspaceId: a.workspaceId,
    });
    const result = await executeTool(
      caller,
      "list_applications",
      { workspaceId: b.workspaceId, userId: "someone-else" },
      { workspaceId: a.workspaceId }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const apps = result.output as Array<{ id: string }>;
    expect(apps.map((x) => x.id)).not.toContain(b.appId);
  });

  it("get_application cannot fetch another workspace's entity by id", async () => {
    const caller = buildAgentCaller({
      userId: a.clerkId,
      workspaceId: a.workspaceId,
    });
    const result = await executeTool(
      caller,
      "get_application",
      { id: b.appId },
      { workspaceId: a.workspaceId }
    );
    // Either the procedure rejects with NOT_FOUND / FORBIDDEN, or returns
    // nothing — the critical invariant is that B's data doesn't leak.
    if (result.ok) {
      expect(result.output).toBeFalsy();
    } else {
      expect(result.error).toMatch(/not[_ ]?found|forbidden/i);
    }
  });
});
