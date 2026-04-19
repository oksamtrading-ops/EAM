import "server-only";
import { createHash } from "node:crypto";
import { anthropic, classifyAnthropicError } from "./client";
import { MODEL_REASONER, type ClaudeModel } from "./models";
import {
  buildAgentCaller,
  executeTool,
  getToolSchemas,
  type AppCaller,
} from "./tools";
import { db } from "@/server/db";

export const MAX_TOOL_ITERATIONS = 6;

export type AgentEvent =
  | { type: "run_started"; runId: string }
  | { type: "conversation_ready"; conversationId: string; title: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; name: string; ok: boolean; output: unknown }
  | { type: "final"; text: string; promptVersion: string; runId: string }
  | { type: "error"; message: string; code: string };

export type AgentHistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

export type AgentLoopOptions = {
  kind: string; // "palette" | "intake" | "rationalization-critic" | "console"
  systemPrompt: string;
  promptVersion: string;
  userMessage: string;
  /** Prior conversation turns (text-only). Included in the first Anthropic call so the agent has context. */
  history?: AgentHistoryTurn[];
  model?: ClaudeModel;
  maxTokens?: number;
  toolFilter?: (name: string) => boolean;
  workspaceId: string;
  userId: string;
  /** Link this run to an AgentConversation so it's discoverable from the thread. */
  conversationId?: string;
  /** Link this run as a sub-run of another run (Phase B — multi-agent orchestration). */
  parentRunId?: string;
  onEvent?: (event: AgentEvent) => void;
};

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    };

export async function runAgentLoop(
  opts: AgentLoopOptions
): Promise<{ runId: string; finalText: string; status: "SUCCEEDED" | "FAILED" }> {
  const {
    kind,
    systemPrompt,
    promptVersion,
    userMessage,
    history,
    model = MODEL_REASONER,
    maxTokens = 1500,
    toolFilter,
    workspaceId,
    userId,
    conversationId,
    parentRunId,
    onEvent,
  } = opts;

  const inputHash = createHash("sha256")
    .update(`${kind}|${promptVersion}|${userMessage}`)
    .digest("hex")
    .slice(0, 32);

  const run = await db.agentRun.create({
    data: {
      workspaceId,
      kind,
      status: "RUNNING",
      inputHash,
      promptVersion,
      model,
      conversationId: conversationId ?? null,
      parentRunId: parentRunId ?? null,
    },
    select: { id: true },
  });
  const runId = run.id;

  onEvent?.({ type: "run_started", runId });

  const caller: AppCaller = buildAgentCaller({ userId, workspaceId });
  const tools = getToolSchemas(
    toolFilter ? (t) => toolFilter(t.name) : undefined
  );

  const messages: Array<{
    role: "user" | "assistant";
    content:
      | string
      | Array<
          | AnthropicContentBlock
          | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }
        >;
  }> = [];

  // Prior conversation context (text-only snapshots of earlier turns).
  // We drop tool_use/tool_result blocks from history — the agent re-grounds
  // by calling tools again when it needs up-to-date data. This keeps
  // multi-turn continuity (e.g. "yes, go ahead") working without replaying
  // stale tool output.
  if (history && history.length > 0) {
    for (const turn of history) {
      const text = turn.content.trim();
      if (!text) continue;
      messages.push({ role: turn.role, content: text });
    }
  }
  messages.push({ role: "user", content: userMessage });

  let finalText = "";
  let ordinal = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;

  try {
    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      const t0 = Date.now();
      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        tools: tools.length
          ? tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.input_schema,
            }))
          : undefined,
        messages: messages as never,
      });
      const latencyMs = Date.now() - t0;

      totalTokensIn += response.usage?.input_tokens ?? 0;
      totalTokensOut += response.usage?.output_tokens ?? 0;

      await db.agentRunStep.create({
        data: {
          runId,
          ordinal: ordinal++,
          kind: "llm",
          payload: {
            model,
            stopReason: response.stop_reason ?? null,
            inputTokens: response.usage?.input_tokens ?? 0,
            outputTokens: response.usage?.output_tokens ?? 0,
          },
          latencyMs,
        },
      });

      const blocks = response.content as unknown as AnthropicContentBlock[];
      const assistantBlocks: AnthropicContentBlock[] = [];
      const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> =
        [];

      for (const block of blocks) {
        if (block.type === "text") {
          assistantBlocks.push(block);
          finalText += block.text;
          if (block.text) onEvent?.({ type: "text_delta", text: block.text });
        } else if (block.type === "tool_use") {
          assistantBlocks.push(block);
          toolUses.push({ id: block.id, name: block.name, input: block.input });
          onEvent?.({
            type: "tool_call",
            id: block.id,
            name: block.name,
            input: block.input,
          });
        }
      }

      messages.push({ role: "assistant", content: assistantBlocks });

      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        await finish(runId, "SUCCEEDED", totalTokensIn, totalTokensOut);
        onEvent?.({ type: "final", text: finalText, promptVersion, runId });
        return { runId, finalText, status: "SUCCEEDED" };
      }

      // Execute tool calls serially, append results as the next user turn.
      const toolResults: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
        is_error?: boolean;
      }> = [];

      for (const call of toolUses) {
        const t = Date.now();
        const result = await executeTool(caller, call.name, call.input, {
          workspaceId,
        });
        const stepLatency = Date.now() - t;

        await db.agentRunStep.create({
          data: {
            runId,
            ordinal: ordinal++,
            kind: result.ok ? "tool_result" : "error",
            toolName: call.name,
            payload: JSON.parse(
              JSON.stringify({
                input: call.input,
                ok: result.ok,
                output: result.ok ? truncateForLog(result.output) : undefined,
                error: result.ok ? undefined : result.error,
              })
            ),
            latencyMs: stepLatency,
          },
        });

        onEvent?.({
          type: "tool_result",
          id: call.id,
          name: call.name,
          ok: result.ok,
          output: result.ok ? result.output : { error: result.error },
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(result.ok ? result.output : { error: result.error }).slice(
            0,
            60_000
          ),
          is_error: !result.ok,
        });
      }

      messages.push({ role: "user", content: toolResults });
    }

    // Iteration cap exhausted.
    await finish(runId, "FAILED", totalTokensIn, totalTokensOut, "Tool iteration cap reached");
    onEvent?.({
      type: "error",
      code: "iteration_cap",
      message: "Agent exceeded tool-iteration cap.",
    });
    return { runId, finalText, status: "FAILED" };
  } catch (err) {
    const info = classifyAnthropicError(err);
    await finish(runId, "FAILED", totalTokensIn, totalTokensOut, info.friendly);
    onEvent?.({ type: "error", code: info.code, message: info.friendly });
    return { runId, finalText, status: "FAILED" };
  }
}

async function finish(
  runId: string,
  status: "SUCCEEDED" | "FAILED",
  tokensIn: number,
  tokensOut: number,
  errorMessage?: string
) {
  await db.agentRun.update({
    where: { id: runId },
    data: {
      status,
      endedAt: new Date(),
      totalTokensIn: tokensIn,
      totalTokensOut: tokensOut,
      errorMessage,
    },
  });
}

function truncateForLog(value: unknown): unknown {
  try {
    const s = JSON.stringify(value);
    if (s.length <= 20_000) return value;
    return { _truncated: true, preview: s.slice(0, 20_000) };
  } catch {
    return { _unserializable: true };
  }
}
