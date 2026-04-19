import "server-only";

// Centralized model IDs. Change here, propagates everywhere.
// Kept as plain string literals so the Anthropic SDK's typed `model` field
// still narrows correctly at the call site.

export const MODEL_SONNET = "claude-sonnet-4-20250514" as const;
export const MODEL_OPUS = "claude-opus-4-6" as const;

// Semantic aliases — use these at call sites to express intent, not a version.
export const MODEL_REASONER = MODEL_SONNET;
export const MODEL_CLASSIFIER = MODEL_OPUS;

export type ClaudeModel = typeof MODEL_SONNET | typeof MODEL_OPUS;
