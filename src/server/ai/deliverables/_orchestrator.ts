import "server-only";

/**
 * Shared LLM-call orchestrator for the deliverables system.
 *
 * Each deliverable template (rationalization plan, capability
 * maturity assessment, future engagement types) runs N parallel
 * LLM calls per generation. Each call has a deterministic
 * fallback. The orchestrator:
 *
 *  - Runs all calls in `Promise.all` for minimum wall-clock
 *  - Aggregates per-call source ("llm" vs "deterministic_fallback")
 *    into a single header-friendly summary
 *  - Emits a granular detail string so the operator can see
 *    WHICH call regressed when partial fallback ships
 *
 * Design rationale: this lifts the 25-line orchestration block
 * the rationalization builder duplicated. Single source of truth
 * for the X-Llm-Source contract across deliverable types.
 *
 * Usage:
 *
 *   const { results, aggregateSource, sourceDetail } =
 *     await runDeliverableLLMCalls({
 *       execSummary: () => generateExecutiveSummary(facts),
 *       bucketNarratives: () => generateBucketNarratives(...),
 *       keyFindings: () => generateKeyFindings(...),
 *       deepDives: () => generateDeepDives(...),
 *     });
 *
 *   // results.execSummary, results.bucketNarratives, etc.
 *   // aggregateSource: "llm" | "deterministic_fallback" | "partial_fallback"
 *   // sourceDetail: "execSummary=llm,bucketNarratives=llm,keyFindings=fallback,deepDives=llm"
 */

export type CallSource = "llm" | "deterministic_fallback";

export type AggregateSource = CallSource | "partial_fallback";

/** Each call returns a result + its source classification.
 *  Result is opaque to the orchestrator — the deliverable
 *  builder defines the per-call result shape. */
export type DeliverableLLMCall<T> = () => Promise<{
  source: CallSource;
  result: T;
}>;

export type DeliverableLLMCallSpec<R extends Record<string, unknown>> = {
  [K in keyof R]: DeliverableLLMCall<R[K]>;
};

export type DeliverableLLMResult<R extends Record<string, unknown>> = {
  results: R;
  /** "llm" if every call succeeded; "deterministic_fallback" if
   *  every call failed; "partial_fallback" otherwise. */
  aggregateSource: AggregateSource;
  /** Granular per-call source string for the X-Llm-Source-Detail
   *  response header. Format:
   *    "callName1=llm,callName2=fallback,callName3=llm" */
  sourceDetail: string;
  /** Per-call source map for callers that want to render
   *  conditional UI based on which call fell back. */
  perCallSource: Record<keyof R, CallSource>;
};

/** Run all calls in parallel. Returns aggregated source + result map.
 *  Order-agnostic — callers reference results by their key. */
export async function runDeliverableLLMCalls<
  R extends Record<string, unknown>,
>(
  calls: DeliverableLLMCallSpec<R>
): Promise<DeliverableLLMResult<R>> {
  const keys = Object.keys(calls) as Array<keyof R>;
  const promises = keys.map((k) => calls[k]());
  const settled = await Promise.all(promises);

  const results = {} as R;
  const perCallSource = {} as Record<keyof R, CallSource>;
  let llmCount = 0;
  let fallbackCount = 0;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]!;
    const out = settled[i]!;
    results[k] = out.result;
    perCallSource[k] = out.source;
    if (out.source === "llm") llmCount++;
    else fallbackCount++;
  }

  const aggregateSource: AggregateSource =
    fallbackCount === 0
      ? "llm"
      : llmCount === 0
        ? "deterministic_fallback"
        : "partial_fallback";

  const sourceDetail = keys
    .map((k) => `${String(k)}=${perCallSource[k] === "llm" ? "llm" : "fallback"}`)
    .join(",");

  return { results, aggregateSource, sourceDetail, perCallSource };
}
