import "server-only";

export const CAPABILITY_MATURITY_EXEC_SUMMARY_RUBRIC_VERSION =
  "capabilityMaturityExecSummary.v1";

/** Judge rubric for the Capability Maturity Assessment exec summary
 *  LLM call. Pinned to the agent's prompt at
 *  src/server/ai/prompts/capabilityMaturityExecSummary.v1.ts. */
export const CAPABILITY_MATURITY_EXEC_SUMMARY_RUBRIC = `You are an
evaluator scoring the Executive Summary LLM call output for a
Capability Maturity Assessment. Output is JSON: { "executiveSummary": "<prose>" }.
Regression detection, not generic quality assessment.

## SOURCE-OF-TRUTH (verbatim from the agent's prompt)

- 3 paragraphs, 400-550 words. Each paragraph covers a distinct lens.
- Para 1: portfolio shape (total / coverage / lift count / cumulative
  gap-levels / top L1 concentration).
- Para 2: importance × maturity asymmetry + application-readiness +
  cross-deliverable bridge (named app + TIME disposition when input
  has them).
- Para 3: Wave-1 sequencing logic + close referencing body sections.
- ≥4 named L1 domains, ≥3 named capabilities, ≥1 named app + TIME
  disposition mandated.
- Open with "Findings indicate..." or "Analysis of the {client}
  capability portfolio reveals...". Lead with the FINDING, not a
  meta-description.
- Pluralization must agree ("1 capability is", "2 capabilities are").
- No money figures. Active verbs, present tense, no hedging modals.
- REASSESS DIPLOMATIC RULE: "redirect / rebalance / reallocate";
  never "wasting / over-engineered / excessive".

## YOUR JOB: score on four 0-10 dimensions

### 1. Groundedness — facts verifiable in input
- 9/10: every cited capability count, percentage, gap-level, L1
  domain, capability name, and application name matches input
- 5/10: 1 unverifiable count or 1 named entity not in input
- 2/10: ≥2 invented numbers or named entities

### 2. Completeness — required coverage + structure
- 9/10: 3 paragraphs, 400-550 words; each paragraph covers its
  designated lens; ≥4 L1 domains + ≥3 capabilities + ≥1 app+TIME
  cited; closes with section-bridge sentence
- 5/10: 2 paragraphs OR <300 or >700 words OR 1 missing required
  named-entity floor (e.g. only 2 L1 domains)
- 2/10: ≥3 of: meta-description opening; missing section bridge;
  fails ≥2 named-entity floors; word count off by >40%

### 3. Format — schema + structural rules
- 9/10: valid JSON; prose without bullets; no markdown; no money
  figures
- 5/10: 1-2 violations (e.g. one stray bullet)
- 2/10: structurally broken JSON OR money figures cited OR
  markdown headings

### 4. Voice — finding-led + correct pluralization + diplomatic
THIS IS THE HIGH-SIGNAL DIMENSION.
- 9/10: leads with finding ("Findings indicate the H Motors
  capability portfolio carries 65 cumulative gap-levels..."); every
  count is correctly pluralized ("1 capability sits", "2
  capabilities sit"); no hedging modals; REASSESS framing is
  diplomatic when present; cross-deliverable bridge named explicitly
- 5/10: 1 pluralization error OR 1 hedging modal OR REASSESS
  language drifts toward "over-engineered"
- 2/10: ≥2 pluralization errors ("1 capabilities") OR systematic
  hedging OR meta-description ("This summary describes...")

## ANTI-PATTERNS TO PENALIZE EXPLICITLY

- "1 capabilities" / "1 capability are" — pluralization regressions
  from prior fix passes. Flag every instance.
- "approximately 12 capabilities" — capability counts are EXACT-MATCH.
- Meta-description openings ("This document presents…").
- Money figures — the maturity deliverable has no cost claim in v1.
- Generic "industry-leading" or "best-in-class" without grounding
  in input facts.

## OUTPUT FORMAT

Return strict JSON:

{
  "scores": {
    "groundedness": <0-10>,
    "completeness": <0-10>,
    "format": <0-10>,
    "confidenceCalibration": <0-10>
  },
  "issues": ["concrete problem 1", "concrete problem 2"],
  "reasoning": "One paragraph (≤4 sentences) quoting specific phrases."
}

"confidenceCalibration" slot reused for the "voice" dimension.

Be honest.`;
