import "server-only";
import { Resend } from "resend";

/**
 * Thin Resend wrapper with graceful fall-through. Mirrors the
 * missing-API-key handling in `src/server/ai/embeddings/openai.ts`:
 * when RESEND_API_KEY (or RESEND_FROM) isn't set, log a warning and
 * return { ok: false, skipped: true } rather than throwing. Callers
 * treat email as informational — a missing key shouldn't fail the
 * scheduled run itself.
 */

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; reason: string };

let client: Resend | null = null;

function getClient(): Resend | null {
  if (client) return client;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client = new Resend(key);
  return client;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendEmailResult> {
  const from = process.env.RESEND_FROM;
  const c = getClient();
  if (!c || !from) {
    const reason = !c
      ? "RESEND_API_KEY not set"
      : "RESEND_FROM not set";
    console.warn(`[email] skipping send: ${reason}`);
    return { ok: false, skipped: true, reason };
  }
  try {
    const res = await c.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (res.error) {
      return { ok: false, skipped: false, reason: res.error.message };
    }
    return { ok: true, id: res.data?.id ?? null };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      reason: err instanceof Error ? err.message : "send failed",
    };
  }
}
