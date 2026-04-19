import "server-only";
import { TRPCError } from "@trpc/server";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { db } from "@/server/db";
import { TOOLS_BY_NAME, type AppCaller, type ToolCtx } from "./definitions";

const createCaller = createCallerFactory(appRouter);

// Build a workspace-scoped tRPC caller for agent tool-use.
// IMPORTANT: workspaceId and userId come from the authenticated HTTP request,
// never from the model's tool-call arguments.
export function buildAgentCaller(opts: {
  userId: string;
  workspaceId: string;
}): AppCaller {
  const caller = createCaller({
    db,
    userId: opts.userId,
    workspaceId: opts.workspaceId,
    headers: new Headers({ "x-workspace-id": opts.workspaceId }),
  });
  return caller as unknown as AppCaller;
}

export type ToolCallResult =
  | { ok: true; output: unknown }
  | { ok: false; error: string };

export async function executeTool(
  caller: AppCaller,
  toolName: string,
  rawInput: unknown,
  toolCtx: ToolCtx
): Promise<ToolCallResult> {
  const tool = TOOLS_BY_NAME[toolName];
  if (!tool) {
    return { ok: false, error: `Unknown tool: ${toolName}` };
  }

  // Strip any workspaceId/userId/ctx-ish keys defensively — the model must not
  // influence auth context even if the tool's Zod schema accidentally accepts them.
  const sanitized = sanitizeInput(rawInput);

  const parsed = tool.inputSchema.safeParse(sanitized);
  if (!parsed.success) {
    return {
      ok: false,
      error: buildValidationError(toolName, sanitized, parsed.error),
    };
  }

  try {
    const output = await tool.invoke(caller, parsed.data, toolCtx);
    return { ok: true, output };
  } catch (err) {
    if (err instanceof TRPCError) {
      return { ok: false, error: `${err.code}: ${err.message}` };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Build a didactic error message when a tool's Zod validation fails so the
 * model can self-correct on the next turn. Lists the expected field names,
 * which ones are missing, and which unexpected keys the model sent.
 */
function buildValidationError(
  toolName: string,
  input: unknown,
  error: { issues?: ReadonlyArray<{ path?: PropertyKey[]; message?: string; code?: string }> }
): string {
  const issues = error.issues ?? [];
  const provided =
    input && typeof input === "object" && !Array.isArray(input)
      ? Object.keys(input as Record<string, unknown>)
      : [];

  const missing = Array.from(
    new Set(
      issues
        .filter((i) => i.code === "invalid_type" && i.message?.toLowerCase().includes("received undefined"))
        .map((i) => String(i.path?.[0] ?? ""))
        .filter(Boolean)
    )
  );

  const details = issues
    .map((i) => {
      const path = (i.path ?? []).join(".") || "(root)";
      return `${path}: ${i.message ?? "invalid"}`;
    })
    .join("; ");

  const parts = [`Invalid input for ${toolName}.`, details];
  if (missing.length > 0) {
    parts.push(`Missing required field(s): ${missing.join(", ")}.`);
  }
  if (provided.length > 0) {
    parts.push(`You sent keys: [${provided.join(", ")}].`);
  }
  parts.push(
    "Check the tool's inputSchema and use the exact parameter names (e.g. `id`, not `draftId` or the entity name)."
  );
  return parts.join(" ");
}

function sanitizeInput(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (k === "workspaceId" || k === "userId" || k === "ctx") continue;
    out[k] = v;
  }
  return out;
}
