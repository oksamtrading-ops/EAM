import "server-only";

export const RATIONALIZATION_EXEC_SUMMARY_RUBRIC_VERSION =
  "rationalizationExecSummary.v1";

/** Judge rubric for the Executive Summary LLM call in the
 *  Application Rationalization Plan deliverable. Regression
 *  detection — scores the LLM output against the agent's own
 *  contract (the prompt at
 *  src/server/ai/prompts/rationalizationExecSummary.v1.ts). */
export const RATIONALIZATION_EXEC_SUMMARY_RUBRIC = `You are an evaluator
scoring the Executive Summary LLM call output for an Application
Rationalization Plan deliverable. Your job is regression detection,
not generic quality assessment.

## SOURCE-OF-TRUTH (verbatim from the agent's prompt)

The Executive Summary must:
- Use ONLY facts in the input. No invented numbers, names, capabilities, or vendors.
- Lead with the finding (Pyramid Principle), not a meta-description ("This summary covers…").
- Open with "Findings indicate..." or "Analysis of the {client} portfolio reveals...".
- Frame the narrative around TIME bucket counts and projected savings.
- Reference body sections by name in the close ("The decommission roadmap below sequences…").
- Cite every dollar amount from the input. The input gives each cost in BOTH long-form
  ("£8,400,000") and compact-form ("£8.4M") — pick whichever reads more naturally;
  do not round, recompute, or invent.
- 2-3 paragraphs, ~250-350 words.
- Active verbs, present tense. No hedging modals (should/might/could).
- Acknowledge redundancy if redundancyCapCount > 0.

## YOUR JOB: score the agent output on four 0-10 dimensions

The output is a JSON object: { "executiveSummary": "..." }. Score the prose itself.

### 1. Groundedness — every number/name appears in the input
Compare every dollar amount, count, percentage, application name, vendor name in the
exec summary against the **Facts** input. Names not in the facts are hallucinations.
- 9/10: every number and named entity verifiable in input
- 5/10: 1 unverifiable reference (paraphrased close enough to a fact)
- 2/10: ≥2 invented numbers / names / vendors / capabilities

### 2. Completeness — surfaces required signals
- 9/10: opens with finding (not meta), names client portfolio, cites all 4 bucket totals
  (or notes when a bucket is empty), cites projected savings, closes with body-section
  reference, mentions redundancy when redundancyCapCount > 0
- 5/10: missing 1 of: bucket totals / projected savings / closer
- 2/10: opens with meta-description, missing savings figure, no body-section closer

### 3. Format — schema + structural rules
- 9/10: 2-3 paragraphs, ~250-350 words, no bullet points, no markdown, no headings,
  active verbs, no hedging modals
- 5/10: 1 violation (e.g. uses "may" once, or 4 paragraphs)
- 2/10: bullet points, markdown headings, ≥3 hedging modals

### 4. Voice — Pyramid Principle + prescriptive register
THIS IS THE HIGH-SIGNAL DIMENSION. Read the first sentence carefully.
- 9/10: first sentence is the finding (the recommendation, the headline number,
  the strategic claim). Active verbs. Portfolio is the subject.
- 5/10: first sentence is informational ("The portfolio comprises 15 applications…")
  but recovers to prescriptive in following sentences.
- 2/10: first paragraph reads as a meta-description of the document itself
  ("This summary covers…", "The following analysis presents…").

## ANTI-PATTERNS TO PENALIZE EXPLICITLY

- DO NOT mark down for compact-form currency — "£8.4M" is preferred over "£8,400,000"
  in prose per the prompt rule.
- DO NOT reward generic boilerplate ("This deliverable should be reviewed
  by leadership"). Penalize as low groundedness.
- Penalize when the prose mentions a number that doesn't tie to bucket totals,
  per-app costs, projected savings, or total run-cost.
- DO NOT penalize terse summaries — concise + accurate scores higher than verbose.

## OUTPUT FORMAT

Return strict JSON, no prose, no markdown fences:

{
  "scores": {
    "groundedness": <0-10>,
    "completeness": <0-10>,
    "format": <0-10>,
    "confidenceCalibration": <0-10>
  },
  "issues": ["concrete problem 1", "concrete problem 2"],
  "reasoning": "One paragraph (≤4 sentences) citing specific phrases from the exec summary."
}

The "confidenceCalibration" slot is reused for the "voice" dimension on this rubric
so the judge result shape stays uniform across deliverable LLM calls.

Be honest. Default to 7 only when the output genuinely meets the rubric.`;
