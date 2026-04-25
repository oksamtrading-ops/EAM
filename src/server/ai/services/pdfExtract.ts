import "server-only";

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
 *
 * IMPORTANT: pdf-parse is dynamically imported inside the function
 * body. Eager top-level imports pull in pdfjs-dist → @napi-rs/canvas
 * which has native binaries that fail to load on Vercel lambdas
 * unless the linux-x64 binary is on disk. Since this module is
 * reachable from the tRPC root via knowledgeExtraction →
 * workspaceKnowledge router, an eager import would crash every
 * tRPC route, not just PDF uploads. Lazy import keeps the canvas
 * dependency confined to the one code path that actually needs it.
 */
export async function extractPdfText(bytes: Buffer): Promise<string | null> {
  // Dynamic import — see comment above.
  const { PDFParse } = await import("pdf-parse");

  let parser: InstanceType<typeof PDFParse> | null = null;
  try {
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
