import "server-only";
import * as XLSX from "xlsx";
import { anthropic } from "@/server/ai/client";
import { MODEL_REASONER } from "@/server/ai/models";
import {
  INTAKE_EXTRACTOR_PROMPT,
  INTAKE_EXTRACTOR_VERSION,
} from "@/server/ai/prompts/intakeExtractor.v1";
import { db } from "@/server/db";
import type { IntakeEntityType } from "@/generated/prisma/client";
import { embedIntakeChunks } from "@/server/ai/embeddings/writeChunkEmbeddings";

const MAX_CHUNK_CHARS = 4000;
const MAX_OUTPUT_TOKENS = 6000;

type DraftCandidate = {
  entityType: IntakeEntityType;
  payload: Record<string, unknown>;
  confidence: number;
  evidence: Array<{ chunkOrdinal: number; excerpt: string; page?: number }>;
};

type ExtractorResponse = {
  chunks: Array<{ ordinal: number; text: string; page?: number }>;
  drafts: DraftCandidate[];
};

const VALID_ENTITY_TYPES = new Set([
  "CAPABILITY",
  "APPLICATION",
  "RISK",
  "VENDOR",
  "TECH_COMPONENT",
]);

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

export async function extractFromDocument(opts: {
  documentId: string;
  workspaceId: string;
  filename: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<{ chunksCreated: number; draftsCreated: number }> {
  const { documentId, workspaceId, filename, mimeType, bytes } = opts;

  await db.intakeDocument.update({
    where: { id: documentId },
    data: { status: "PROCESSING" },
  });

  try {
    let extractor: ExtractorResponse;

    if (mimeType === "application/pdf") {
      extractor = await extractFromPdf(bytes, filename);
    } else if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimeType === "application/vnd.ms-excel"
    ) {
      extractor = await extractFromXlsx(bytes, filename);
    } else {
      const text = bytes.toString("utf-8");
      extractor = await extractFromText(text, filename);
    }

    // Persist chunks then drafts
    await db.$transaction(async (tx) => {
      if (extractor.chunks.length) {
        await tx.intakeChunk.createMany({
          data: extractor.chunks.map((c) => ({
            documentId,
            ordinal: c.ordinal,
            text: c.text.slice(0, 8000),
            page: c.page ?? null,
          })),
        });
      }

      // Re-read inserted chunk IDs so evidence can refer to them by chunkOrdinal.
      const chunks = await tx.intakeChunk.findMany({
        where: { documentId },
        select: { id: true, ordinal: true },
      });
      const ordinalToId = new Map(chunks.map((c) => [c.ordinal, c.id]));

      for (const d of extractor.drafts) {
        if (!VALID_ENTITY_TYPES.has(d.entityType)) continue;
        const evidence = (d.evidence ?? [])
          .map((e) => ({
            chunkId: ordinalToId.get(e.chunkOrdinal) ?? null,
            excerpt: typeof e.excerpt === "string" ? e.excerpt.slice(0, 600) : "",
            page: typeof e.page === "number" ? e.page : null,
          }))
          .filter((e) => e.excerpt.length > 0);

        await tx.intakeDraft.create({
          data: {
            workspaceId,
            documentId,
            entityType: d.entityType,
            payload: JSON.parse(JSON.stringify(d.payload ?? {})),
            confidence: clamp01(d.confidence ?? 0),
            evidence: JSON.parse(JSON.stringify(evidence)),
            status: "PENDING",
          },
        });
      }

      await tx.intakeDocument.update({
        where: { id: documentId },
        data: { status: "EXTRACTED" },
      });
    });

    // Backfill pgvector embeddings outside the transaction — cheap,
    // non-blocking for retrieval (keyword fallback works regardless),
    // and graceful if OPENAI_API_KEY isn't configured.
    await embedIntakeChunks(documentId).catch((err) => {
      console.warn(
        `[intake] embedding backfill failed for ${documentId}: ${err instanceof Error ? err.message : String(err)}`
      );
    });

    return {
      chunksCreated: extractor.chunks.length,
      draftsCreated: extractor.drafts.length,
    };
  } catch (err) {
    await db.intakeDocument.update({
      where: { id: documentId },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

async function extractFromPdf(
  bytes: Buffer,
  filename: string
): Promise<ExtractorResponse> {
  const base64 = bytes.toString("base64");
  const response = await anthropic.messages.create({
    model: MODEL_REASONER,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: INTAKE_EXTRACTOR_PROMPT,
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
            text: `Filename: ${filename}\n\nExtract a concise list of text chunks (~1-2 paragraphs each, tagged with page numbers) and draft EA entities per the system prompt. Return JSON only.`,
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

    // Header chunk: the column set communicates intent to the extractor.
    const columns = Object.keys(rows[0] ?? {});
    chunks.push({
      ordinal: ordinal++,
      text: `[Sheet: ${sheetName}] Columns: ${columns.join(" | ")}. ${rows.length} rows.`,
    });

    for (const [i, row] of rows.entries()) {
      // Skip empty rows
      const values = Object.values(row).filter(
        (v) => v !== "" && v != null
      );
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

  if (chunks.length === 0) {
    return { chunks: [], drafts: [] };
  }

  const pre = chunks
    .map((c) => `<<CHUNK ordinal=${c.ordinal}>>\n${c.text}`)
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: MODEL_REASONER,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: INTAKE_EXTRACTOR_PROMPT,
    messages: [
      {
        role: "user",
        content: `Filename: ${filename}\nPreChunked: true\nSource: Excel workbook\n\n${pre}\n\nEach row is a separate chunk. Column headers reveal which entity types the sheet represents (e.g., "Name, Vendor, Lifecycle" implies applications). One row usually maps to one draft. Return JSON only.`,
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
    system: INTAKE_EXTRACTOR_PROMPT,
    messages: [
      {
        role: "user",
        content: `Filename: ${filename}\nPreChunked: true\n\n${pre}\n\nUse the provided chunks (do not re-chunk). Cite evidence by chunkOrdinal. Return JSON only.`,
      },
    ],
  });
  const parsed = parseExtractorResponse(response);
  // Prefer caller-provided chunks if the model echoes different ones
  if (!parsed.chunks.length) parsed.chunks = chunks;
  return parsed;
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

  const drafts = Array.isArray(parsed.drafts)
    ? parsed.drafts.map((d) => ({
        entityType: String(d.entityType ?? "") as IntakeEntityType,
        payload:
          d.payload && typeof d.payload === "object"
            ? (d.payload as Record<string, unknown>)
            : {},
        confidence: typeof d.confidence === "number" ? d.confidence : 0,
        evidence: Array.isArray(d.evidence)
          ? d.evidence.map((e) => ({
              chunkOrdinal:
                typeof e.chunkOrdinal === "number" ? e.chunkOrdinal : 0,
              excerpt: typeof e.excerpt === "string" ? e.excerpt : "",
              page: typeof e.page === "number" ? e.page : undefined,
            }))
          : [],
      }))
    : [];

  return { chunks, drafts };
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

export { INTAKE_EXTRACTOR_VERSION };
