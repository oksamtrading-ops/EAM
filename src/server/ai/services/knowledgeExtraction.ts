import "server-only";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { anthropic } from "@/server/ai/client";
import { MODEL_REASONER } from "@/server/ai/models";
import {
  KNOWLEDGE_FACTS_EXTRACTOR_PROMPT,
  KNOWLEDGE_FACTS_EXTRACTOR_VERSION,
} from "@/server/ai/prompts/knowledgeFactsExtractor.v1";
import { db } from "@/server/db";
import type { WorkspaceKnowledgeKind } from "@/generated/prisma/client";
import { embedIntakeChunks } from "@/server/ai/embeddings/writeChunkEmbeddings";
import { embedKnowledgeRow } from "@/server/ai/embeddings/writeKnowledgeEmbeddings";
import { findSimilarKnowledge } from "@/server/ai/knowledge/findSimilar";
import { loadAgentSettings } from "@/server/ai/settings";
import { extractPdfText } from "@/server/ai/services/pdfExtract";

const MAX_CHUNK_CHARS = 4000;
const MAX_OUTPUT_TOKENS = 6000;

type FactCandidate = {
  subject: string;
  statement: string;
  kind: WorkspaceKnowledgeKind;
  confidence: number;
  evidence: Array<{ chunkOrdinal: number; excerpt: string; page?: number | null }>;
};

type ExtractorResponse = {
  chunks: Array<{ ordinal: number; text: string; page?: number | null }>;
  facts: FactCandidate[];
};

const VALID_KINDS = new Set<WorkspaceKnowledgeKind>([
  "FACT",
  "DECISION",
  "PATTERN",
]);

/**
 * Run fact extraction against an existing IntakeDocument — re-uses its
 * stored chunks, no re-parsing. Landing point: KnowledgeDraft rows.
 */
export async function extractKnowledgeFromExistingDocument(opts: {
  documentId: string;
  workspaceId: string;
}): Promise<{ draftsCreated: number }> {
  const { documentId, workspaceId } = opts;

  const doc = await db.intakeDocument.findFirst({
    where: { id: documentId, workspaceId },
    select: { id: true, filename: true },
  });
  if (!doc) throw new Error("Document not found in this workspace");

  const chunks = await db.intakeChunk.findMany({
    where: { documentId: doc.id },
    orderBy: { ordinal: "asc" },
    select: { id: true, ordinal: true, text: true, page: true },
  });
  if (chunks.length === 0) {
    throw new Error("Document has no chunks — intake extraction has not run yet.");
  }

  const pre = chunks
    .map((c) => `<<CHUNK ordinal=${c.ordinal}>>\n${c.text}`)
    .join("\n\n");
  const response = await anthropic.messages.create({
    model: MODEL_REASONER,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: KNOWLEDGE_FACTS_EXTRACTOR_PROMPT,
    messages: [
      {
        role: "user",
        content: `Filename: ${doc.filename}\nPreChunked: true\n\n${pre}\n\nUse the provided chunks. Cite evidence by chunkOrdinal. Return JSON only.`,
      },
    ],
  });

  const parsed = parseExtractorResponse(response);
  const ordinalToChunkId = new Map(chunks.map((c) => [c.ordinal, c.id]));

  // Existing-doc path: chunks were already persisted by whichever
  // extractor ran first (intake or knowledge upload). Backfill
  // embeddings if they're missing — cheap and idempotent enough.
  await embedIntakeChunks(doc.id).catch(() => {});

  return persistDrafts({
    workspaceId,
    sourceDocumentId: doc.id,
    facts: parsed.facts,
    ordinalToChunkId,
  });
}

/**
 * Run fact extraction against a fresh upload — parse + chunk + persist
 * an IntakeDocument row so evidence citations have a stable source, then
 * extract facts.
 */
export async function extractKnowledgeFromNewUpload(opts: {
  workspaceId: string;
  userId: string; // internal User.id (uploadedBy)
  bytes: Buffer;
  filename: string;
  mimeType: string;
  /** When true, parse + chunk + persist the document only; skip the LLM extraction pass. */
  skipExtraction?: boolean;
}): Promise<{ documentId: string; draftsCreated: number; extracted: boolean }> {
  const { workspaceId, userId, bytes, filename, mimeType, skipExtraction } =
    opts;

  // Persist the document so chunks + any future drafts can cite it.
  const document = await db.intakeDocument.create({
    data: {
      workspaceId,
      filename,
      mimeType,
      sizeBytes: bytes.length,
      storageKey: `inline:${filename}`,
      status: "PROCESSING",
      uploadedBy: userId,
    },
    select: { id: true },
  });

  try {
    // Two paths:
    // - skipExtraction=true → parse + chunk only; no Anthropic call.
    // - default → full distill pass, emit KnowledgeDraft rows.
    if (skipExtraction) {
      const chunks = await parseAndChunk(bytes, mimeType, filename);
      if (chunks.length > 0) {
        await db.intakeChunk.createMany({
          data: chunks.map((c) => ({
            documentId: document.id,
            ordinal: c.ordinal,
            text: c.text.slice(0, 8000),
            page: c.page ?? null,
          })),
        });
      }
      // Backfill embeddings — makes the doc semantically searchable
      // immediately, even without a distill pass.
      await embedIntakeChunks(document.id).catch(() => {});
      await db.intakeDocument.update({
        where: { id: document.id },
        data: { status: "EXTRACTED" },
      });
      return { documentId: document.id, draftsCreated: 0, extracted: false };
    }

    let extractor: ExtractorResponse;
    if (mimeType === "application/pdf") {
      extractor = await extractFromPdf(bytes, filename);
    } else if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimeType === "application/vnd.ms-excel"
    ) {
      extractor = await extractFromXlsx(bytes, filename);
    } else if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword"
    ) {
      const text = (await mammoth.extractRawText({ buffer: bytes })).value ?? "";
      extractor = await extractFromText(text, filename);
    } else {
      extractor = await extractFromText(bytes.toString("utf-8"), filename);
    }

    if (extractor.chunks.length > 0) {
      await db.intakeChunk.createMany({
        data: extractor.chunks.map((c) => ({
          documentId: document.id,
          ordinal: c.ordinal,
          text: c.text.slice(0, 8000),
          page: c.page ?? null,
        })),
      });
    }

    const savedChunks = await db.intakeChunk.findMany({
      where: { documentId: document.id },
      select: { id: true, ordinal: true },
    });
    const ordinalToChunkId = new Map(savedChunks.map((c) => [c.ordinal, c.id]));

    const result = await persistDrafts({
      workspaceId,
      sourceDocumentId: document.id,
      facts: extractor.facts,
      ordinalToChunkId,
    });

    await db.intakeDocument.update({
      where: { id: document.id },
      data: { status: "EXTRACTED" },
    });

    // Backfill embeddings after the drafts land — non-blocking for
    // the extractor, lets semantic retrieval work on next turn.
    await embedIntakeChunks(document.id).catch(() => {});

    return {
      documentId: document.id,
      draftsCreated: result.draftsCreated,
      extracted: true,
    };
  } catch (err) {
    await db.intakeDocument.update({
      where: { id: document.id },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

/**
 * Cheap parse-and-chunk path shared by the "upload only" mode.
 * Mirrors what the full extractors produce locally but skips the
 * Anthropic call. For PDFs we don't have pdf-parse installed, so we
 * store a single metadata chunk; the user can run distill later which
 * sends the PDF to Anthropic's native document block.
 */
async function parseAndChunk(
  bytes: Buffer,
  mimeType: string,
  filename: string
): Promise<Array<{ ordinal: number; text: string; page?: number | null }>> {
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    // Reuse the xlsx chunker — no LLM call.
    const wb = XLSX.read(bytes, { type: "buffer" });
    const chunks: Array<{ ordinal: number; text: string }> = [];
    let ordinal = 0;
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });
      if (rows.length === 0) continue;
      const columns = Object.keys(rows[0] ?? {});
      chunks.push({
        ordinal: ordinal++,
        text: `[Sheet: ${sheetName}] Columns: ${columns.join(" | ")}. ${rows.length} rows.`,
      });
      for (const [i, row] of rows.entries()) {
        const values = Object.values(row).filter((v) => v !== "" && v != null);
        if (values.length === 0) continue;
        const serialized = Object.entries(row)
          .filter(([, v]) => v !== "" && v != null)
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join(" | ");
        chunks.push({
          ordinal: ordinal++,
          text: `[${sheetName} · row ${i + 2}] ${serialized}`,
        });
      }
    }
    return chunks;
  }

  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return chunkPlainText(bytes.toString("utf-8"));
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const text = (await mammoth.extractRawText({ buffer: bytes })).value ?? "";
    return chunkPlainText(text);
  }

  if (mimeType === "application/pdf") {
    // Server-side PDF text extraction via pdf-parse. Success → chunk
    // like any other plain text. Failure (corrupted PDF, image-only
    // scan, pdf-parse throws) → fall back to the legacy placeholder
    // so the upload still lands and the distill-later path (which
    // ships the raw PDF to Anthropic's native document block) stays
    // available.
    const text = await extractPdfText(bytes);
    if (text && text.length > 0) {
      return chunkPlainText(text);
    }
    console.warn(
      `[parseAndChunk] PDF "${filename}" yielded no extractable text — stamping placeholder chunk.`
    );
    return [
      {
        ordinal: 0,
        text: `[PDF] ${filename} — ${bytes.length.toLocaleString()} bytes. Pending distillation.`,
      },
    ];
  }

  return [];
}

async function persistDrafts(opts: {
  workspaceId: string;
  sourceDocumentId: string;
  facts: FactCandidate[];
  ordinalToChunkId: Map<number, string>;
}): Promise<{ draftsCreated: number }> {
  const { workspaceId, sourceDocumentId, facts, ordinalToChunkId } = opts;

  // Auto-accept threshold is per-workspace. When set, drafts with
  // confidence at or above the threshold commit directly to
  // WorkspaceKnowledge and skip the approval queue.
  const settings = await loadAgentSettings(workspaceId);
  const autoAccept = settings.autoAcceptConfidence;

  let count = 0;
  for (const f of facts) {
    if (!VALID_KINDS.has(f.kind)) continue;
    if (!f.subject?.trim() || !f.statement?.trim()) continue;
    if (!Array.isArray(f.evidence) || f.evidence.length === 0) continue;

    const evidence = f.evidence
      .map((e) => ({
        chunkId: ordinalToChunkId.get(e.chunkOrdinal) ?? null,
        chunkOrdinal: e.chunkOrdinal,
        excerpt:
          typeof e.excerpt === "string" ? e.excerpt.slice(0, 600) : "",
        page: typeof e.page === "number" ? e.page : null,
      }))
      .filter((e) => e.excerpt.length > 0);
    if (evidence.length === 0) continue;

    const subject = f.subject.trim().slice(0, 200);
    const statement = f.statement.trim().slice(0, 2000);
    const confidence = clamp01(f.confidence ?? 0.8);

    const shouldAutoAccept =
      autoAccept != null && confidence >= autoAccept;

    if (shouldAutoAccept) {
      // Skip the draft entirely and commit straight to
      // WorkspaceKnowledge. We still record a draft row so the
      // trace has provenance, but mark it ACCEPTED up front.
      const committed = await db.workspaceKnowledge.create({
        data: {
          workspaceId,
          kind: f.kind,
          subject,
          statement,
          confidence,
        },
        select: { id: true },
      });
      await embedKnowledgeRow(committed.id).catch(() => {});
      await db.knowledgeDraft.create({
        data: {
          workspaceId,
          sourceDocumentId,
          kind: f.kind,
          subject,
          statement,
          confidence,
          evidence: JSON.parse(JSON.stringify(evidence)),
          status: "ACCEPTED",
          reviewedAt: new Date(),
          committedKnowledgeId: committed.id,
        },
      });
    } else {
      // Flag likely duplicates via semantic similarity so the review
      // UI can surface a Supersede / Keep-both action. Fail-open on
      // embedding errors — the draft still lands without a dedup
      // hint.
      const similarKnowledgeId = await findSimilarKnowledge({
        workspaceId,
        subject,
        statement,
      }).catch(() => null);

      await db.knowledgeDraft.create({
        data: {
          workspaceId,
          sourceDocumentId,
          kind: f.kind,
          subject,
          statement,
          confidence,
          evidence: JSON.parse(JSON.stringify(evidence)),
          status: "PENDING",
          similarKnowledgeId,
        },
      });
    }
    count++;
  }
  return { draftsCreated: count };
}

// ────────────────────────────────────────────────────────────
// Parsers — mirror intakeExtraction.ts but emit facts, not entities.
// ────────────────────────────────────────────────────────────

async function extractFromPdf(
  bytes: Buffer,
  filename: string
): Promise<ExtractorResponse> {
  const base64 = bytes.toString("base64");
  const response = await anthropic.messages.create({
    model: MODEL_REASONER,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: KNOWLEDGE_FACTS_EXTRACTOR_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          } as never,
          {
            type: "text",
            text: `Filename: ${filename}\n\nSegment the text into chunks tagged with page numbers, then distill the document into durable FACTS per the system prompt. Return JSON only.`,
          },
        ],
      },
    ],
  });
  return parseExtractorResponse(response);
}

async function extractFromXlsx(
  bytes: Buffer,
  filename: string
): Promise<ExtractorResponse> {
  const wb = XLSX.read(bytes, { type: "buffer" });
  const chunks: Array<{ ordinal: number; text: string }> = [];
  let ordinal = 0;
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });
    if (rows.length === 0) continue;
    const columns = Object.keys(rows[0] ?? {});
    chunks.push({
      ordinal: ordinal++,
      text: `[Sheet: ${sheetName}] Columns: ${columns.join(" | ")}. ${rows.length} rows.`,
    });
    for (const [i, row] of rows.entries()) {
      const values = Object.values(row).filter((v) => v !== "" && v != null);
      if (values.length === 0) continue;
      const serialized = Object.entries(row)
        .filter(([, v]) => v !== "" && v != null)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(" | ");
      chunks.push({
        ordinal: ordinal++,
        text: `[${sheetName} · row ${i + 2}] ${serialized}`,
      });
    }
  }
  if (chunks.length === 0) return { chunks: [], facts: [] };

  const pre = chunks
    .map((c) => `<<CHUNK ordinal=${c.ordinal}>>\n${c.text}`)
    .join("\n\n");
  const response = await anthropic.messages.create({
    model: MODEL_REASONER,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: KNOWLEDGE_FACTS_EXTRACTOR_PROMPT,
    messages: [
      {
        role: "user",
        content: `Filename: ${filename}\nPreChunked: true\nSource: Excel workbook\n\n${pre}\n\nDistill recurring structural patterns and durable facts from this data. Return JSON only.`,
      },
    ],
  });
  const parsed = parseExtractorResponse(response);
  if (!parsed.chunks.length) parsed.chunks = chunks;
  return parsed;
}

async function extractFromText(
  text: string,
  filename: string
): Promise<ExtractorResponse> {
  const chunks = chunkPlainText(text);
  const pre = chunks
    .map((c) => `<<CHUNK ordinal=${c.ordinal}>>\n${c.text}`)
    .join("\n\n");
  const response = await anthropic.messages.create({
    model: MODEL_REASONER,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: KNOWLEDGE_FACTS_EXTRACTOR_PROMPT,
    messages: [
      {
        role: "user",
        content: `Filename: ${filename}\nPreChunked: true\n\n${pre}\n\nDistill durable facts per the system prompt. Return JSON only.`,
      },
    ],
  });
  const parsed = parseExtractorResponse(response);
  if (!parsed.chunks.length) parsed.chunks = chunks;
  return parsed;
}

function chunkPlainText(text: string): Array<{ ordinal: number; text: string }> {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: Array<{ ordinal: number; text: string }> = [];
  let buffer = "";
  let ordinal = 0;
  for (const para of paragraphs) {
    if ((buffer + "\n\n" + para).length > MAX_CHUNK_CHARS && buffer) {
      chunks.push({ ordinal: ordinal++, text: buffer.trim() });
      buffer = para;
    } else {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    }
  }
  if (buffer.trim()) chunks.push({ ordinal: ordinal++, text: buffer.trim() });
  return chunks;
}

function parseExtractorResponse(response: {
  content: Array<{ type: string; text?: string }>;
}): ExtractorResponse {
  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock?.text ?? "";
  const json = extractJson(raw);
  const parsed = JSON.parse(json) as Partial<ExtractorResponse>;

  const chunks = Array.isArray(parsed.chunks)
    ? parsed.chunks
        .map((c, i) => ({
          ordinal: typeof c.ordinal === "number" ? c.ordinal : i,
          text: typeof c.text === "string" ? c.text : "",
          page: typeof c.page === "number" ? c.page : undefined,
        }))
        .filter((c) => c.text.length > 0)
    : [];

  const facts = Array.isArray(parsed.facts)
    ? parsed.facts.map((f) => ({
        subject: typeof f.subject === "string" ? f.subject : "",
        statement: typeof f.statement === "string" ? f.statement : "",
        kind: (String(f.kind ?? "FACT").toUpperCase() as WorkspaceKnowledgeKind),
        confidence: typeof f.confidence === "number" ? f.confidence : 0.8,
        evidence: Array.isArray(f.evidence)
          ? f.evidence.map((e) => ({
              chunkOrdinal:
                typeof e.chunkOrdinal === "number" ? e.chunkOrdinal : 0,
              excerpt: typeof e.excerpt === "string" ? e.excerpt : "",
              page: typeof e.page === "number" ? e.page : undefined,
            }))
          : [],
      }))
    : [];

  return { chunks, facts };
}

function extractJson(raw: string): string {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) return fence[1].trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) return raw.slice(first, last + 1);
  return raw.trim();
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export { KNOWLEDGE_FACTS_EXTRACTOR_VERSION };
