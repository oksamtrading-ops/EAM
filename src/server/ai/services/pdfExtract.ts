import "server-only";
import { PDFParse } from "pdf-parse";

const MAX_PAGES = 500;

/**
 * Server-side PDF text extraction for the skip-distill upload path.
 * Returns concatenated plain text per page, joined with blank lines,
 * so downstream `chunkPlainText()` can split at paragraph boundaries.
 *
 * Graceful-fail pattern (same as `src/server/ai/embeddings/openai.ts`
 * and `src/server/email/client.ts`): log a warning and return `null`
 * when extraction throws or yields no text. Callers treat null as
 * "fall back to the placeholder chunk" — malformed or image-only
 * PDFs still upload successfully.
 */
export async function extractPdfText(bytes: Buffer): Promise<string | null> {
  let parser: PDFParse | null = null;
  try {
    // PDFParse wraps pdfjs-dist; it converts Node Buffer → Uint8Array
    // on its own via the `data` option. MAX_PAGES bounds lambda cost
    // on pathological 2000-page decks.
    parser = new PDFParse({ data: bytes });
    const result = await parser.getText({ last: MAX_PAGES });
    const text = (result.text ?? "").trim();
    if (!text) return null;
    return text;
  } catch (err) {
    console.warn(
      `[pdf-extract] failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  } finally {
    await parser?.destroy().catch(() => {});
  }
}
