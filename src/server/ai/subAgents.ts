import "server-only";
import { runAgentLoop } from "@/server/ai/agentLoop";
import {
  RATIONALIZE_APP_PROMPT,
  RATIONALIZE_APP_VERSION,
} from "@/server/ai/prompts/rationalizeApp.v1";
import {
  IMPACT_ANALYSIS_PROMPT,
  IMPACT_ANALYSIS_VERSION,
} from "@/server/ai/prompts/impactAnalysis.v1";
import {
  CAPABILITY_COVERAGE_PROMPT,
  CAPABILITY_COVERAGE_VERSION,
} from "@/server/ai/prompts/capabilityCoverage.v1";
import type { ToolCtx } from "@/server/ai/tools/definitions";

const DEFAULT_SUB_AGENT_BUDGET = 3;
const SUB_AGENT_MAX_TOKENS = 4000;

type SubAgentName =
  | "rationalize_application"
  | "analyze_application_impact"
  | "capability_coverage_report";

type SubAgentConfig = {
  prompt: string;
  version: string;
  kind: string;
  allowedTools: ReadonlySet<string>;
  /** Render the user-message that kicks off the sub-agent loop. */
  userMessage: (input: Record<string, unknown>) => string;
};

const CONFIGS: Record<SubAgentName, SubAgentConfig> = {
  rationalize_application: {
    prompt: RATIONALIZE_APP_PROMPT,
    version: RATIONALIZE_APP_VERSION,
    kind: "sub-agent:rationalize_application",
    allowedTools: new Set([
      "get_application",
      "list_applications",
      "list_capabilities",
      "list_risks",
      "list_technology_components",
    ]),
    userMessage: ({ id }) =>
      `Classify application id "${String(id)}" using the TIME rubric. Return JSON only per the system prompt.`,
  },
  analyze_application_impact: {
    prompt: IMPACT_ANALYSIS_PROMPT,
    version: IMPACT_ANALYSIS_VERSION,
    kind: "sub-agent:analyze_application_impact",
    allowedTools: new Set([
      "get_application",
      "list_applications",
      "list_capabilities",
    ]),
    userMessage: ({ id }) =>
      `Assess the impact of retiring application id "${String(id)}". Return JSON only per the system prompt.`,
  },
  capability_coverage_report: {
    prompt: CAPABILITY_COVERAGE_PROMPT,
    version: CAPABILITY_COVERAGE_VERSION,
    kind: "sub-agent:capability_coverage_report",
    allowedTools: new Set(["list_capabilities", "list_applications"]),
    userMessage: () =>
      `Produce a capability coverage report for the current workspace. Return JSON only per the system prompt.`,
  },
};

export type SubAgentResult =
  | {
      ok: true;
      runId: string;
      result: unknown;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Invoked by sub-agent tool definitions. Runs a full agent loop with a
 * scoped system prompt, a restricted tool subset (no sub-agents → no
 * recursion), and a link back to the parent run. Budget-gated by the
 * parent loop via ctx.subAgentCallsSoFar vs ctx.subAgentBudget.
 */
export async function runSubAgent(
  name: SubAgentName,
  input: Record<string, unknown>,
  ctx: ToolCtx
): Promise<SubAgentResult> {
  if (!ctx.workspaceId || !ctx.userId) {
    return { ok: false, error: "Sub-agent requires workspaceId + userId in context." };
  }
  const budget = ctx.subAgentBudget ?? DEFAULT_SUB_AGENT_BUDGET;
  const used = ctx.subAgentCallsSoFar ?? 0;
  if (used >= budget) {
    return {
      ok: false,
      error: `Sub-agent budget exhausted (${used}/${budget} per turn). Summarize from what you have.`,
    };
  }

  const config = CONFIGS[name];

  try {
    const loopResult = await runAgentLoop({
      kind: config.kind,
      systemPrompt: config.prompt,
      promptVersion: config.version,
      userMessage: config.userMessage(input),
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      parentRunId: ctx.parentRunId,
      maxTokens: SUB_AGENT_MAX_TOKENS,
      // Strip sub-agent tools from the filter → no recursive sub-agent calls.
      toolFilter: (toolName) => config.allowedTools.has(toolName),
      // Anthropic-native JSON: prefill `{` so the model continues mid-object.
      // parseJson reattaches the opening brace before parsing.
      expectsJson: true,
    });

    let parsed: unknown;
    try {
      parsed = parseJson(loopResult.finalText);
    } catch (err) {
      console.error(
        JSON.stringify({
          evt: "subagent_json_parse_fail",
          runId: loopResult.runId,
          subAgent: name,
          message: err instanceof Error ? err.message : String(err),
          textPreview: loopResult.finalText.slice(0, 200),
        })
      );
      return {
        ok: false,
        error: `Sub-agent ${name} produced unparseable JSON.`,
      };
    }

    return {
      ok: true,
      runId: loopResult.runId,
      result: parsed,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Sub-agent run failed.",
    };
  }
}

/** With assistant prefill `{` the model returns the continuation only.
 *  Always reattach the opening brace before parsing. Throws on invalid JSON;
 *  the caller surfaces a typed error event. */
function parseJson(raw: string): unknown {
  return JSON.parse("{" + raw);
}
