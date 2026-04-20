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
import { sendEmail } from "@/server/email/client";
import { renderScheduledRunCompleteEmail } from "@/server/email/templates/scheduledRunComplete";

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
    include: {
      user: { select: { clerkId: true } },
      workspace: { select: { name: true, clientName: true } },
    },
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

    // Best-effort notification. `task.notifyMode === ALWAYS` fires on
    // every completion; ON_FAILURE only fires on the catch branch.
    // Email errors never fail the run.
    if (task.notifyEmail && task.notifyMode === "ALWAYS") {
      await notifyCompletion({
        task,
        runId: result.runId,
        status: "SUCCEEDED",
        errorMessage: null,
      }).catch((e) => {
        console.warn(`[scheduled-email] notify failed: ${String(e)}`);
      });
    }

    return { runId: result.runId };
  } catch (err) {
    await db.scheduledAgentTask.update({
      where: { id: task.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt,
      },
    });
    const errorMessage =
      err instanceof Error ? err.message : "Scheduled run failed";
    if (
      task.notifyEmail &&
      (task.notifyMode === "ALWAYS" || task.notifyMode === "ON_FAILURE")
    ) {
      await notifyCompletion({
        task,
        runId: null,
        status: "FAILED",
        errorMessage,
      }).catch((e) => {
        console.warn(`[scheduled-email] notify failed: ${String(e)}`);
      });
    }
    return { error: errorMessage };
  }
}

/**
 * Pull the final assistant text for the run (so the email includes a
 * useful preview) and hand off to the Resend client. Graceful failure
 * — a missing API key no-ops; a Resend error is logged but doesn't
 * propagate.
 */
async function notifyCompletion(opts: {
  task: {
    id: string;
    name: string;
    notifyEmail: string | null;
    workspace: { name: string; clientName: string | null };
  };
  runId: string | null;
  status: "SUCCEEDED" | "FAILED";
  errorMessage: string | null;
}): Promise<void> {
  const { task, runId, status, errorMessage } = opts;
  if (!task.notifyEmail) return;

  let excerpt: string | null = null;
  if (runId) {
    const lastMsg = await db.agentConversationMessage
      .findFirst({
        where: { runId, role: "assistant" },
        orderBy: { ordinal: "desc" },
        select: { content: true },
      })
      .catch(() => null);
    if (lastMsg?.content) {
      excerpt = lastMsg.content.slice(0, 500);
      if (lastMsg.content.length > 500) excerpt += "…";
    }
  }

  const workspaceLabel =
    task.workspace.clientName?.trim() || task.workspace.name;

  const { subject, html, text } = renderScheduledRunCompleteEmail({
    taskName: task.name,
    workspaceLabel,
    runId,
    status,
    excerpt,
    errorMessage,
  });

  const result = await sendEmail({
    to: task.notifyEmail,
    subject,
    html,
    text,
  });
  if (!result.ok && !result.skipped) {
    console.warn(
      `[scheduled-email] Resend rejected send for task ${task.id}: ${result.reason}`
    );
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
