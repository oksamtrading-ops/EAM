import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const globalForAnthropic = globalThis as unknown as {
  anthropic: Anthropic | undefined;
};

export const anthropic =
  globalForAnthropic.anthropic ??
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

if (process.env.NODE_ENV !== "production") {
  globalForAnthropic.anthropic = anthropic;
}

export type AnthropicErrorInfo = {
  code: "overloaded" | "rate_limited" | "auth" | "upstream" | "unknown";
  friendly: string;
  retriable: boolean;
};

export function classifyAnthropicError(err: unknown): AnthropicErrorInfo {
  const anyErr = err as { message?: unknown; status?: number } | null;
  const raw = typeof anyErr?.message === "string" ? anyErr.message : String(err ?? "");
  const status = anyErr?.status;

  if (/overloaded/i.test(raw) || status === 529) {
    return {
      code: "overloaded",
      friendly: "Claude is temporarily overloaded. Please try again in a moment.",
      retriable: true,
    };
  }
  if (status === 429 || /rate.?limit/i.test(raw)) {
    return {
      code: "rate_limited",
      friendly: "Claude is rate-limited right now — try again shortly.",
      retriable: true,
    };
  }
  if (status === 401 || status === 403) {
    return {
      code: "auth",
      friendly: "AI service is not authorized. Contact admin.",
      retriable: false,
    };
  }
  if (status && status >= 500) {
    return {
      code: "upstream",
      friendly: "Claude is having issues. Please retry.",
      retriable: true,
    };
  }
  return {
    code: "unknown",
    friendly: "Something went wrong. Please try again.",
    retriable: false,
  };
}
