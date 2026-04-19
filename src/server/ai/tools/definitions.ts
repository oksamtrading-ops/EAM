import "server-only";
import { z } from "zod";
import { retrieveIntakeChunks } from "@/server/ai/rag/retrieve";
import { runSubAgent } from "@/server/ai/subAgents";

// Caller type — workspaceId is baked in at construction time (see executor).
// The model can ask to call any of these tools with any inputs, but it cannot
// pass a workspaceId: we don't even expose a workspaceId parameter at this layer.
//
// We intentionally type the caller loosely here: tRPC's caller is a deeply
// nested proxy whose exact type depends on the router shape and is hard to
// express via structural types. Each tool below is a thin typed wrapper; the
// runtime allowlist (TOOLS_BY_NAME) is what actually constrains model behavior.
export type AppCaller = Record<string, Record<string, (input?: unknown) => Promise<unknown>>>;

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  invoke: (
    caller: AppCaller,
    input: unknown,
    ctx: ToolCtx
  ) => Promise<unknown>;
  /** Marks tools that create/update/delete data. Useful for agent prompts and UI confirmation gates. */
  mutates?: boolean;
  /** Marks tools that internally spawn a full agent loop. Budget-tracked by the parent loop. */
  isSubAgent?: boolean;
};

export type ToolCtx = {
  workspaceId: string;
  /** Clerk userId — needed by sub-agent tools that call runAgentLoop themselves. */
  userId?: string;
  /** AgentRun id of the caller, used to link sub-runs back to the parent. */
  parentRunId?: string;
  /** How many sub-agent tool calls have already happened in the current parent turn. */
  subAgentCallsSoFar?: number;
  /** Hard cap per user turn. */
  subAgentBudget?: number;
};

// ---- HORIZON 1 TOOL ALLOWLIST ----
// Read-only only. Writes go through the approval queue (intake router — later PR).

const listApplications: ToolDefinition = {
  name: "list_applications",
  description:
    "List applications in the current workspace. Optional filters: lifecycle (ACTIVE|PLANNED|PHASING_OUT|RETIRED|SUNSET), rationalization (TOLERATE|INVEST|MIGRATE|ELIMINATE), search (case-insensitive substring of name).",
  inputSchema: z
    .object({
      lifecycle: z.string().optional(),
      rationalization: z.string().optional(),
      search: z.string().optional(),
    })
    .optional(),
  invoke: (caller, input) => caller.application.list(input),
};

const getApplicationById: ToolDefinition = {
  name: "get_application",
  description:
    "Fetch a single application by id, including its capabilities, interfaces, assessments, and owners.",
  inputSchema: z.object({ id: z.string() }),
  invoke: (caller, input) => caller.application.getById(input),
};

const listCapabilities: ToolDefinition = {
  name: "list_capabilities",
  description: "List business capabilities (L1/L2/L3) in the current workspace.",
  inputSchema: z.object({}).optional(),
  invoke: (caller) => caller.capability.list(),
};

const listRisks: ToolDefinition = {
  name: "list_risks",
  description: "List technology risks in the current workspace.",
  inputSchema: z.object({}).optional(),
  invoke: (caller) => caller.risk.list(),
};

const listInitiatives: ToolDefinition = {
  name: "list_initiatives",
  description: "List roadmap initiatives in the current workspace.",
  inputSchema: z.object({}).optional(),
  invoke: (caller) => caller.initiative.list(),
};

const listTechnologyComponents: ToolDefinition = {
  name: "list_technology_components",
  description: "List technology components (stack elements) in the current workspace.",
  inputSchema: z.object({}).optional(),
  invoke: (caller) => caller.technologyComponent.list(),
};

const listReferenceArchitectures: ToolDefinition = {
  name: "list_reference_architectures",
  description: "List reference architectures available in the workspace.",
  inputSchema: z.object({}).optional(),
  invoke: (caller) => caller.referenceArchitecture.list(),
};

// ---- RAG: search uploaded intake documents ----

const searchIntakeDocuments: ToolDefinition = {
  name: "search_intake_documents",
  description:
    "Keyword search over uploaded intake documents (PDFs, spreadsheets, notes). Returns matching excerpts with their source filename and page/row. Use this to cite what a client document says about a topic.",
  inputSchema: z.object({
    query: z.string().min(3),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  invoke: async (_caller, input, ctx) => {
    const { query, limit } = input as { query: string; limit?: number };
    return retrieveIntakeChunks({
      workspaceId: ctx.workspaceId,
      query,
      limit: limit ?? 8,
    });
  },
};

// ---- Intake approval queue (read) ----

const listIntakeDrafts: ToolDefinition = {
  name: "list_intake_drafts",
  description:
    "List drafts in the intake approval queue. Optional filters: status (PENDING|ACCEPTED|REJECTED|MODIFIED), entityType (CAPABILITY|APPLICATION|RISK|VENDOR|TECH_COMPONENT), documentId.",
  inputSchema: z
    .object({
      status: z.string().optional(),
      entityType: z.string().optional(),
      documentId: z.string().optional(),
    })
    .optional(),
  invoke: (caller, input) => caller.intake.listDrafts(input),
};

// ---- Intake approval queue (write) — safe because the intake queue exists for approval ----

const acceptIntakeDraft: ToolDefinition = {
  name: "accept_intake_draft",
  description:
    "Accept an intake draft, committing it as a real record (capability, application, risk, or vendor). The `id` parameter MUST be the `id` string from a prior list_intake_drafts result (not `draftId`, not the entity name). ALWAYS confirm with the user before calling this tool.",
  inputSchema: z.object({
    id: z.string().describe("The draft's `id` field from list_intake_drafts."),
    overrides: z.record(z.string(), z.unknown()).optional(),
  }),
  invoke: (caller, input) => caller.intake.acceptDraft(input),
  mutates: true,
};

const rejectIntakeDraft: ToolDefinition = {
  name: "reject_intake_draft",
  description:
    "Reject an intake draft. The `id` parameter MUST be the `id` string from a prior list_intake_drafts result (not `draftId`, not the entity name). ALWAYS confirm with the user before calling this tool.",
  inputSchema: z.object({
    id: z.string().describe("The draft's `id` field from list_intake_drafts."),
    reason: z.string().optional(),
  }),
  invoke: (caller, input) => caller.intake.rejectDraft(input),
  mutates: true,
};

const modifyIntakeDraft: ToolDefinition = {
  name: "modify_intake_draft",
  description:
    "Update an intake draft's payload (marks status as MODIFIED, does not commit). The `id` parameter MUST be the `id` string from a prior list_intake_drafts result (not `draftId`, not the entity name). ALWAYS confirm with the user before calling this tool.",
  inputSchema: z.object({
    id: z.string().describe("The draft's `id` field from list_intake_drafts."),
    payload: z.record(z.string(), z.unknown()),
  }),
  invoke: (caller, input) => caller.intake.modifyDraft(input),
  mutates: true,
};

// ---- Sub-agents (Phase B — multi-agent orchestration) ----

const rationalizeApplicationSub: ToolDefinition = {
  name: "rationalize_application",
  description:
    "Run a specialized sub-agent that produces a grounded Gartner TIME classification for ONE application. It fetches the app, its capabilities, and related risks via tools. Returns JSON with { classification, confidence, rationale, evidence, topRisks, relatedCapabilities }. Max 3 sub-agent calls per user turn — prefer this over fan-out across many apps.",
  inputSchema: z.object({
    id: z
      .string()
      .describe(
        "Application id from list_applications. Must be an exact id string."
      ),
  }),
  invoke: (_caller, input, ctx) =>
    runSubAgent("rationalize_application", input as { id: string }, ctx),
  isSubAgent: true,
};

const analyzeApplicationImpactSub: ToolDefinition = {
  name: "analyze_application_impact",
  description:
    "Run a specialized sub-agent to assess the impact of retiring or replacing ONE application. Fetches the target, the portfolio, and the capability tree. Returns JSON with affected capabilities, alternatives, coverage gaps, overall risk level, and recommendation. Max 3 sub-agent calls per user turn.",
  inputSchema: z.object({
    id: z
      .string()
      .describe(
        "Application id from list_applications. Must be an exact id string."
      ),
  }),
  invoke: (_caller, input, ctx) =>
    runSubAgent(
      "analyze_application_impact",
      input as { id: string },
      ctx
    ),
  isSubAgent: true,
};

const capabilityCoverageReportSub: ToolDefinition = {
  name: "capability_coverage_report",
  description:
    "Run a specialized sub-agent that produces a capability coverage report across the workspace: well-served, underserved, unserved, and overlap capabilities, with recommendations for the overlapping ones. Cheap and high-leverage for broad portfolio questions. Max 3 sub-agent calls per user turn.",
  inputSchema: z.object({}).optional(),
  invoke: (_caller, _input, ctx) =>
    runSubAgent("capability_coverage_report", {}, ctx),
  isSubAgent: true,
};

export const TOOL_DEFINITIONS: ReadonlyArray<ToolDefinition> = [
  listApplications,
  getApplicationById,
  listCapabilities,
  listRisks,
  listInitiatives,
  listTechnologyComponents,
  listReferenceArchitectures,
  searchIntakeDocuments,
  listIntakeDrafts,
  acceptIntakeDraft,
  rejectIntakeDraft,
  modifyIntakeDraft,
  rationalizeApplicationSub,
  analyzeApplicationImpactSub,
  capabilityCoverageReportSub,
];

export const TOOLS_BY_NAME: Record<string, ToolDefinition> = Object.fromEntries(
  TOOL_DEFINITIONS.map((t) => [t.name, t])
);
