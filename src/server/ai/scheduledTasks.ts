import "server-only";
import { CronExpressionParser } from "cron-parser";
import { db } from "@/server/db";
import { runAgentLoop } from "@/server/ai/agentLoop";
import {
  AGENT_CONSOLE_PROMPT,
  AGENT_CONSOLE_PROMPT_VERSION,
} from "@/server/ai/prompts/agentConsole.v1";
import {
  retrieveKnowledge,
  formatKnowledgeForPrompt,
} from "@/server/ai/knowledge/retrieve";

function computeNextRun(cronExpression: string, from: Date = new Date()): Date {
  return CronExpressionParser.parse(cronExpression, {
    currentDate: from,
  })
    .next()
    .toDate();
}

/**
 * Run one scheduled task and update its bookkeeping.
 * Safe to call both from the cron endpoint (due-check loop) and from
 * the "run now" UI action — the worker reads the task row fresh.
 */
export async function executeScheduledTask(
  taskId: string
): Promise<{ runId?: string; error?: string }> {
  const task = await db.scheduledAgentTask.findUnique({
    where: { id: taskId },
    include: { user: { select: { clerkId: true } } },
  });
  if (!task) return { error: "Task not found" };

  // Compute nextRunAt up front so a long-running run doesn't block the
  // next schedule slot. lastRunAt is set from the run start.
  const nextRunAt = (() => {
    try {
      return computeNextRun(task.cronExpression);
    } catch {
      return null;
    }
  })();

  const knowledge = await retrieveKnowledge({
    workspaceId: task.workspaceId,
    query: task.prompt,
    limit: 5,
  }).catch(() => []);
  const systemPrompt =
    knowledge.length > 0
      ? `${AGENT_CONSOLE_PROMPT}\n\n${formatKnowledgeForPrompt(knowledge)}`
      : AGENT_CONSOLE_PROMPT;

  try {
    const result = await runAgentLoop({
      kind: `scheduled:${task.name}`.slice(0, 80),
      systemPrompt,
      promptVersion: AGENT_CONSOLE_PROMPT_VERSION,
      userMessage: task.prompt,
      workspaceId: task.workspaceId,
      userId: task.user.clerkId,
    });

    await db.scheduledAgentTask.update({
      where: { id: task.id },
      data: {
        lastRunAt: new Date(),
        lastRunId: result.runId,
        nextRunAt,
      },
    });

    return { runId: result.runId };
  } catch (err) {
    await db.scheduledAgentTask.update({
      where: { id: task.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt,
      },
    });
    return {
      error: err instanceof Error ? err.message : "Scheduled run failed",
    };
  }
}

/**
 * Find and execute every task whose nextRunAt is due.
 * Called from the Vercel Cron endpoint (hourly by default).
 */
export async function executeDueScheduledTasks(): Promise<{
  executed: number;
  failed: number;
}> {
  const now = new Date();
  const due = await db.scheduledAgentTask.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: now },
    },
    select: { id: true },
    take: 25, // bound per-tick work
  });

  let executed = 0;
  let failed = 0;
  for (const t of due) {
    const result = await executeScheduledTask(t.id);
    if (result.error) failed++;
    else executed++;
  }
  return { executed, failed };
}
