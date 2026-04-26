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
import { TOOLS_BY_NAME } from "./tools/definitions";
import { loadAgentSettings, AGENT_SETTINGS_DEFAULTS } from "./settings";
import { checkBudget } from "./budget";
import { db } from "@/server/db";

// Legacy exports kept for any callers that imported these constants.
// The live values come from loadAgentSettings(workspaceId) at run start.
export const MAX_TOOL_ITERATIONS = AGENT_SETTINGS_DEFAULTS.maxToolIterations;
const DEFAULT_SUB_AGENT_BUDGET = AGENT_SETTINGS_DEFAULTS.subAgentBudget;

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
  /** When true, append a `{` assistant prefill so the model continues mid-JSON.
   *  The caller is responsible for parsing the response with `"{" + text`. */
  expectsJson?: boolean;
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
    maxTokens: maxTokensOverride,
    toolFilter,
    workspaceId,
    userId,
    conversationId,
    parentRunId,
    onEvent,
    expectsJson,
  } = opts;

  // Per-workspace tunables (falls back to defaults when no row).
  // Sub-agent calls forward their own maxTokens via opts.maxTokens so
  // they don't inherit the parent's larger budget.
  const settings = await loadAgentSettings(workspaceId);
  const maxTokens = maxTokensOverride ?? settings.llmMaxTokens;
  const maxToolIterations = settings.maxToolIterations;
  const subAgentBudget = settings.subAgentBudget;

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
  let subAgentCallsSoFar = 0;

  try {
    for (let iter = 0; iter < maxToolIterations; iter++) {
      // Budget gate — hard kill before the next paid Anthropic call.
      const budget = await checkBudget(db, workspaceId);
      console.log(
        JSON.stringify({
          evt: "budget_check",
          runId,
          workspaceId,
          spentUsd: budget.spentUsd,
          capUsd: budget.capUsd,
          outcome: budget.ok ? "pass" : "block",
        })
      );
      if (!budget.ok) {
        const msg = `Workspace AI budget exceeded ($${budget.spentUsd.toFixed(2)}/$${budget.capUsd}). Raise the cap or wait for the rolling 30-day window to roll forward.`;
        onEvent?.({ type: "error", message: msg, code: "budget_exceeded" });
        await finish(
          runId,
          "FAILED",
          totalTokensIn,
          totalTokensOut,
          "budget_exceeded"
        );
        return { runId, finalText, status: "FAILED" };
      }

      const t0 = Date.now();
      // Prefill `{` when JSON is expected so the model continues
      // mid-object. The prefill is sent in apiMessages but never
      // persisted in `messages` — Anthropic returns only the
      // continuation; the caller must reattach `{` when parsing.
      const apiMessages = expectsJson
        ? [...messages, { role: "assistant" as const, content: "{" }]
        : messages;

      const toolDefs = tools.length
        ? tools.map((t, i) => {
            const base = {
              name: t.name,
              description: t.description,
              input_schema: t.input_schema,
            };
            // cache_control on the LAST tool extends the cache prefix
            // to cover system prompt + every tool def.
            return i === tools.length - 1
              ? { ...base, cache_control: { type: "ephemeral" as const } }
              : base;
          })
        : undefined;

      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system: [
          {
            type: "text" as const,
            text: systemPrompt,
            cache_control: { type: "ephemeral" as const },
          },
        ],
        tools: toolDefs as never,
        messages: apiMessages as never,
      });
      const latencyMs = Date.now() - t0;

      const usage = response.usage as
        | {
            input_tokens?: number;
            output_tokens?: number;
            cache_read_input_tokens?: number;
            cache_creation_input_tokens?: number;
          }
        | undefined;

      totalTokensIn += usage?.input_tokens ?? 0;
      totalTokensOut += usage?.output_tokens ?? 0;

      console.log(
        JSON.stringify({
          evt: "agent_step",
          runId,
          workspaceId,
          model,
          iter,
          tokensIn: usage?.input_tokens ?? 0,
          tokensOut: usage?.output_tokens ?? 0,
          cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
          cacheCreationTokens: usage?.cache_creation_input_tokens ?? 0,
          latencyMs,
        })
      );

      await db.agentRunStep.create({
        data: {
          runId,
          ordinal: ordinal++,
          kind: "llm",
          payload: {
            model,
            stopReason: response.stop_reason ?? null,
            inputTokens: usage?.input_tokens ?? 0,
            outputTokens: usage?.output_tokens ?? 0,
            cacheReadTokensIn: usage?.cache_read_input_tokens ?? 0,
            cacheCreationTokensIn: usage?.cache_creation_input_tokens ?? 0,
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
        const isSubAgentCall = TOOLS_BY_NAME[call.name]?.isSubAgent === true;
        const result = await executeTool(caller, call.name, call.input, {
          workspaceId,
          userId,
          parentRunId: runId,
          subAgentCallsSoFar,
          subAgentBudget,
        });
        if (isSubAgentCall) subAgentCallsSoFar += 1;
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
