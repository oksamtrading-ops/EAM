import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { rateLimit } from "@/lib/rate-limit";
import {
  runAgentLoop,
  type AgentEvent,
  type AgentHistoryTurn,
} from "@/server/ai/agentLoop";
import {
  AGENT_CONSOLE_PROMPT,
  AGENT_CONSOLE_PROMPT_VERSION,
} from "@/server/ai/prompts/agentConsole.v1";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = (await req.json()) as {
    workspaceId?: string;
    message?: string;
    history?: AgentHistoryTurn[];
  };
  const { workspaceId, message, history } = body;
  const safeHistory: AgentHistoryTurn[] = Array.isArray(history)
    ? history
        .filter(
          (t): t is AgentHistoryTurn =>
            !!t &&
            (t.role === "user" || t.role === "assistant") &&
            typeof t.content === "string"
        )
        .slice(-20) // last 20 turns — hard cap to bound prompt growth
    : [];
  if (!workspaceId) return new Response("Missing workspaceId", { status: 400 });
  if (!message || typeof message !== "string") {
    return new Response("Missing message", { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  });
  if (!user) return new Response("User not found", { status: 401 });

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, userId: user.id },
    select: { id: true },
  });
  if (!workspace) return new Response("Forbidden", { status: 403 });

  const { allowed } = rateLimit(`agent-console:${userId}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (!allowed) return new Response("Rate limited", { status: 429 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) => {
        controller.enqueue(
          encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
        );
      };

      try {
        await runAgentLoop({
          kind: "console",
          systemPrompt: AGENT_CONSOLE_PROMPT,
          promptVersion: AGENT_CONSOLE_PROMPT_VERSION,
          userMessage: message,
          history: safeHistory,
          workspaceId,
          // workspaceProcedure's middleware resolves ctx.userId → User.clerkId,
          // so we must pass the Clerk id here, not the internal user.id.
          userId: userId,
          onEvent: send,
        });
      } catch (err) {
        send({
          type: "error",
          code: "internal",
          message: err instanceof Error ? err.message : "Agent run failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
