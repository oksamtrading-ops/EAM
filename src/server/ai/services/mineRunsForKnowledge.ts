import "server-only";
import { db } from "@/server/db";
import { anthropic } from "@/server/ai/client";
import { MODEL_REASONER } from "@/server/ai/models";
import {
  KNOWLEDGE_FACTS_EXTRACTOR_PROMPT,
} from "@/server/ai/prompts/knowledgeFactsExtractor.v1";
import { loadAgentSettings } from "@/server/ai/settings";
import {
  persistOneDraft,
  type FactCandidate,
} from "@/server/ai/services/knowledgeExtraction";

const DEFAULT_RUN_LIMIT = 25;
const MAX_RUN_LIMIT = 100;
const FINAL_TEXT_CAP_CHARS = 8_000;
const MIN_TEXT_CHARS = 200;

type ExtractorResponse = {
  chunks?: Array<{ ordinal: number; text: string; page?: number | null }>;
  facts?: FactCandidate[];
};

/**
 * Sweep recent successful AgentRun outputs in a workspace, run the
 * existing fact-extractor over each one's final assistant text, and
 * persist any durable findings as KnowledgeDraft rows for the user
 * to review. Idempotent: skips runs that already produced drafts
 * (any draft with the matching sourceRunId is considered "already
 * mined").
 *
 * Reuses every primitive: KNOWLEDGE_FACTS_EXTRACTOR_PROMPT,
 * persistOneDraft (which handles dedup + auto-accept + embedding),
 * loadAgentSettings.
 */
export async function mineRecentRunsForKnowledge(opts: {
  workspaceId: string;
  limit?: number;
}): Promise<{
  runsScanned: number;
  draftsCreated: number;
  runsSkipped: number;
}> {
  const { workspaceId } = opts;
  const limit = Math.min(
    Math.max(opts.limit ?? DEFAULT_RUN_LIMIT, 1),
    MAX_RUN_LIMIT
  );

  // Parent runs only — sub-agent fan-outs roll up into their parent's
  // assistant text, so mining sub-runs would double-count.
  const runs = await db.agentRun.findMany({
    where: {
      workspaceId,
      status: "SUCCEEDED",
      parentRunId: null,
    },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: { id: true },
  });

  const settings = await loadAgentSettings(workspaceId);

  let runsScanned = 0;
  let runsSkipped = 0;
  let draftsCreated = 0;

  for (const run of runs) {
    // Idempotency: skip if any draft already exists for this run.
    // Cheap exists-check; we don't care which draft.
    const alreadyMined = await db.knowledgeDraft.findFirst({
      where: { sourceRunId: run.id },
      select: { id: true },
    });
    if (alreadyMined) {
      runsSkipped++;
      continue;
    }

    const lastMessage = await db.agentConversationMessage.findFirst({
      where: { runId: run.id, role: "assistant" },
      orderBy: { ordinal: "desc" },
      select: { content: true },
    });
    const text = (lastMessage?.content ?? "").trim();
    if (text.length < MIN_TEXT_CHARS) {
      runsScanned++;
      continue;
    }

    const truncated = text.slice(0, FINAL_TEXT_CAP_CHARS);

    let facts: FactCandidate[] = [];
    try {
      const response = await anthropic.messages.create({
        model: MODEL_REASONER,
        max_tokens: 1500,
        system: KNOWLEDGE_FACTS_EXTRACTOR_PROMPT,
        messages: [
          {
            role: "user",
            content: `Source: agent-run final answer. PreChunked: false.\n\n<<CHUNK ordinal=0>>\n${truncated}\n\nReturn JSON only.`,
          },
        ],
      });
      const block = response.content.find((b) => b.type === "text");
      const raw =
        block && "text" in block && typeof block.text === "string"
          ? block.text
          : "";
      const json = extractJson(raw);
      const parsed = JSON.parse(json) as ExtractorResponse;
      if (Array.isArray(parsed.facts)) facts = parsed.facts;
    } catch (err) {
      console.warn(
        `[mine-runs] extraction failed for run ${run.id}: ${err instanceof Error ? err.message : String(err)}`
      );
      runsScanned++;
      continue;
    }

    // Single-chunk synthetic mapping — there's one "chunk" of input
    // (the run's final text) so all evidence rows reference ordinal 0.
    // No IntakeChunk row exists, so chunkId stays null.
    const ordinalToChunkId = new Map<number, string>();

    for (const fact of facts) {
      const ok = await persistOneDraft({
        workspaceId,
        sourceDocumentId: null,
        sourceRunId: run.id,
        fact,
        ordinalToChunkId,
        autoAcceptConfidence: settings.autoAcceptConfidence,
      });
      if (ok) draftsCreated++;
    }

    runsScanned++;
  }

  return { runsScanned, draftsCreated, runsSkipped };
}

function extractJson(raw: string): string {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) return fence[1].trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) return raw.slice(first, last + 1);
  return raw.trim();
}
