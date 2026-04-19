import "server-only";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;
const MAX_TOKENS_PER_INPUT = 8000; // OpenAI caps at 8191 — leave headroom
const MAX_BATCH_SIZE = 96;

/**
 * Result from batch embedding. Indices align with the input array.
 * `null` entries mean that item was skipped (empty input or API failure);
 * callers should treat null as "no embedding available, fall back to
 * keyword search" rather than an error.
 */
export type EmbeddingResult = (number[] | null)[];

/**
 * Embed an array of texts with OpenAI text-embedding-3-small.
 *
 * Graceful degradation: if OPENAI_API_KEY is missing or the API call
 * fails, returns an array of nulls (same length as input). The rest
 * of the system treats this as "no semantic index yet — use keyword
 * retrieval instead" rather than failing the upload.
 */
export async function embedBatch(texts: string[]): Promise<EmbeddingResult> {
  if (texts.length === 0) return [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Explicit no-op rather than throwing — keyword retrieval still works.
    return texts.map(() => null);
  }

  const result: EmbeddingResult = new Array(texts.length).fill(null);

  // Normalize inputs. OpenAI rejects empty strings; truncate long ones.
  const prepared = texts.map((t) => prepareInput(t));

  // Batch up to MAX_BATCH_SIZE per request.
  for (let start = 0; start < prepared.length; start += MAX_BATCH_SIZE) {
    const slice = prepared.slice(start, start + MAX_BATCH_SIZE);

    // Filter out empty slots; remember their original indices.
    const payloadIndices: number[] = [];
    const payloadInputs: string[] = [];
    for (let i = 0; i < slice.length; i++) {
      if (slice[i]) {
        payloadIndices.push(start + i);
        payloadInputs.push(slice[i]!);
      }
    }
    if (payloadInputs.length === 0) continue;

    try {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: payloadInputs,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn(
          `[embeddings] OpenAI ${res.status}: ${body.slice(0, 300)}`
        );
        continue;
      }
      const data = (await res.json()) as {
        data: { index: number; embedding: number[] }[];
      };
      for (const entry of data.data) {
        const originalIdx = payloadIndices[entry.index];
        if (originalIdx == null) continue;
        result[originalIdx] = entry.embedding;
      }
    } catch (err) {
      console.warn(
        `[embeddings] fetch failed: ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }
  }

  return result;
}

export async function embedOne(text: string): Promise<number[] | null> {
  const [result] = await embedBatch([text]);
  return result ?? null;
}

function prepareInput(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  // Rough token budget: ~4 chars/token average → truncate by char count.
  const charBudget = MAX_TOKENS_PER_INPUT * 4;
  if (trimmed.length <= charBudget) return trimmed;
  return trimmed.slice(0, charBudget);
}

export function pgvectorLiteral(embedding: number[]): string {
  // Postgres vector literal: "[0.1,0.2,...]"
  return `[${embedding.join(",")}]`;
}

export { EMBEDDING_DIMS, EMBEDDING_MODEL };
