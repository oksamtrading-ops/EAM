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
import {
  retrieveKnowledge,
  formatKnowledgeForPrompt,
} from "@/server/ai/knowledge/retrieve";

export const runtime = "nodejs";
export const maxDuration = 120;

const HISTORY_CAP = 20;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = (await req.json()) as {
    workspaceId?: string;
    message?: string;
    conversationId?: string;
    /**
     * Optional client history fallback. Ignored if conversationId is
     * provided — the server rehydrates from the DB (source of truth).
     */
    history?: AgentHistoryTurn[];
  };
  const { workspaceId, message, conversationId: incomingConversationId } = body;
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

  // Resolve (or create) the conversation. If the caller supplied an id,
  // verify ownership; never trust the id blindly.
  let conversationId: string | null = null;
  let conversationTitle = "";
  if (incomingConversationId) {
    const existing = await db.agentConversation.findFirst({
      where: {
        id: incomingConversationId,
        workspaceId,
        userId: user.id,
      },
      select: { id: true, title: true },
    });
    if (existing) {
      conversationId = existing.id;
      conversationTitle = existing.title;
    }
  }
  if (!conversationId) {
    const created = await db.agentConversation.create({
      data: {
        workspaceId,
        userId: user.id,
        title: deriveTitle(message),
        kind: "console",
      },
      select: { id: true, title: true },
    });
    conversationId = created.id;
    conversationTitle = created.title;
  }

  // Persisted history is the source of truth; build from DB.
  const priorMessages = await db.agentConversationMessage.findMany({
    where: { conversationId },
    orderBy: { ordinal: "asc" },
    select: { ordinal: true, role: true, content: true },
  });
  const history: AgentHistoryTurn[] = priorMessages
    .filter(
      (m): m is { ordinal: number; role: "user" | "assistant"; content: string } =>
        m.role === "user" || m.role === "assistant"
    )
    .slice(-HISTORY_CAP)
    .map((m) => ({ role: m.role, content: m.content }));

  // Persist the new user turn before running the agent so it's on the
  // transcript even if the model call fails downstream.
  const nextOrdinal = (priorMessages[priorMessages.length - 1]?.ordinal ?? -1) + 1;
  await db.agentConversationMessage.create({
    data: {
      conversationId,
      ordinal: nextOrdinal,
      role: "user",
      content: message,
    },
  });

  // Accumulator for the assistant turn we'll persist at the end.
  const toolCallsForTurn: Array<{
    id: string;
    name: string;
    input: unknown;
    ok?: boolean;
    output?: unknown;
  }> = [];
  let finalTextForTurn = "";
  let runIdForTurn: string | null = null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Tracks whether the SSE controller is still accepting writes.
      // When the browser disconnects mid-stream (navigating away,
      // closing the console, mobile backgrounding), controller.enqueue
      // throws. We swallow that — the agent run still completes on
      // the server and gets persisted; the client just missed the tail
      // of the stream and can re-open the thread to see the full
      // answer hydrated from the DB.
      let clientConnected = true;

      const send = (event: AgentEvent) => {
        if (clientConnected) {
          try {
            controller.enqueue(
              encoder.encode(
                `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
              )
            );
          } catch {
            clientConnected = false;
          }
        }

        // Snapshot to persist as the assistant message
        if (event.type === "tool_call") {
          toolCallsForTurn.push({
            id: event.id,
            name: event.name,
            input: event.input,
          });
        } else if (event.type === "tool_result") {
          const entry = toolCallsForTurn.find((c) => c.id === event.id);
          if (entry) {
            entry.ok = event.ok;
            entry.output = event.output;
          }
        } else if (event.type === "text_delta") {
          finalTextForTurn += event.text;
        } else if (event.type === "final") {
          finalTextForTurn = event.text;
          runIdForTurn = event.runId;
        } else if (event.type === "run_started") {
          runIdForTurn = event.runId;
        }
      };

      // Tell the client which conversation we're writing to (for initial
      // creation: the id is new to them).
      send({
        type: "conversation_ready",
        conversationId: conversationId!,
        title: conversationTitle,
      });

      // Inject top-matched workspace knowledge into the system prompt.
      // Small and cheap (ILIKE + in-memory scoring) — done per turn so
      // newly-saved facts surface immediately.
      const knowledge = await retrieveKnowledge({
        workspaceId,
        query: message,
        limit: 5,
      }).catch(() => []);
      const systemPromptWithContext =
        knowledge.length > 0
          ? `${AGENT_CONSOLE_PROMPT}\n\n${formatKnowledgeForPrompt(knowledge)}`
          : AGENT_CONSOLE_PROMPT;

      try {
        await runAgentLoop({
          kind: "console",
          systemPrompt: systemPromptWithContext,
          promptVersion: AGENT_CONSOLE_PROMPT_VERSION,
          userMessage: message,
          history,
          workspaceId,
          // workspaceProcedure's middleware resolves ctx.userId → User.clerkId,
          // so we must pass the Clerk id here, not the internal user.id.
          userId: userId,
          conversationId,
          onEvent: send,
        });
      } catch (err) {
        send({
          type: "error",
          code: "internal",
          message: err instanceof Error ? err.message : "Agent run failed",
        });
      } finally {
        // Persist the assistant turn (even partial — errors included).
        try {
          await db.agentConversationMessage.create({
            data: {
              conversationId: conversationId!,
              ordinal: nextOrdinal + 1,
              role: "assistant",
              content: finalTextForTurn,
              toolCalls:
                toolCallsForTurn.length > 0
                  ? JSON.parse(JSON.stringify(toolCallsForTurn))
                  : undefined,
              runId: runIdForTurn,
            },
          });
          await db.agentConversation.update({
            where: { id: conversationId! },
            data: { updatedAt: new Date() },
          });
        } catch {
          // Non-fatal — the trace is still in AgentRun/AgentRunStep.
        }
        if (clientConnected) {
          try {
            controller.close();
          } catch {
            // Client already went away; nothing to close.
          }
        }
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

function deriveTitle(firstMessage: string): string {
  const cleaned = firstMessage.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 80) return cleaned;
  return cleaned.slice(0, 77) + "…";
}
