import "server-only";

export const RATIONALIZATION_DEEP_DIVES_VERSION =
  "rationalizationDeepDives.v1";

/**
 * Per-app deep-dive prose for the top-decile applications by cost.
 * Top-5 by cost are passed in; the LLM emits a structured JSON
 * map keyed by app id. Each entry carries:
 *
 *  - dispositionRationale: 2-3 sentences explaining WHY the
 *    disposition (grounded in BV/TH/Lifecycle and capability
 *    presence/absence).
 *  - migrationPath: 1-2 sentences naming the recommended path
 *    (target platform, sequencing constraint, contract or
 *    knowledge-capture trigger).
 *  - waveJustification: 1 sentence placing the app in NOW / NEXT /
 *    LATER and stating why.
 *
 * Single batched LLM call; structured JSON output. Same fact-grounding
 * tolerance check as bucket narratives.
 */
export const RATIONALIZATION_DEEP_DIVES_PROMPT = `You are drafting
per-application deep-dive prose for the top-cost applications in a
client portfolio. Each application gets three short paragraphs;
together they justify the disposition decision and stake out the
recommended path.

You will receive a structured set of deterministic facts including
per-app: name, vendor, lifecycle, businessValue, technicalHealth,
disposition (TIME bucket), annualCost (long + compact), capabilities
the app supports, and alternative apps in the portfolio that cover
the same capabilities (the "redundancy matrix" subset).

Use ONLY those facts. Do NOT introduce numbers, names, or
capabilities not in the input.

## STRUCTURE PER APPLICATION

Produce three fields:

1. **dispositionRationale** — 2-3 sentences (50-90 words) explaining
   why this app sits in its TIME bucket. Reference the BV, TH, and
   lifecycle from the facts. When capabilityAlternatives is empty,
   note that there is no alternative app in the portfolio (a strong
   signal toward MIGRATE rather than ELIMINATE for high-BV apps).
   When capabilityAlternatives is non-empty, the consolidation
   opportunity is part of the rationale.

2. **migrationPath** — 1-2 sentences (30-60 words) naming the
   recommended path. For MIGRATE: target platform genre and
   sequencing constraint. For ELIMINATE: data archival / contract
   cliff / capability successor. For INVEST: capacity expansion /
   integration enhancement / scope. For TOLERATE: maintenance scope.
   Be specific where the facts support it (named technology, named
   wave, dated milestone). Be conservative where they don't —
   "platform modernization" beats inventing a target.

3. **waveJustification** — 1 sentence (15-30 words) placing the app
   in NOW (<12mo) / NEXT (12-24mo) / LATER (24-36mo) and stating
   why. PHASING_OUT lifecycle drives NOW; ACTIVE drives NEXT or
   LATER depending on disposition; PLANNED INVEST is a forward
   capacity decision and reads LATER unless cost dictates otherwise.

## RULES

- Every dollar amount must appear in the input. The input gives
  each cost in BOTH long-form ("£8,400,000") and compact-form
  ("£8.4M") — pick whichever reads more naturally in your prose.
  Do not round, recompute, or invent numbers.
- Application names, vendor names, and capability names must come
  from the input
- Active verbs, present tense. No hedging modals
  (should/might/could → use will/does/is). Third-person consulting
  voice.
- No bullet points. No markdown. No headings within the prose.
- Don't speculate about timelines, vendors, or technologies not in
  the facts (no "by Q3 2027" unless the facts cite the year)
- For ELIMINATE apps with no capability alternative in the matrix:
  EXPLICITLY name the gap as the gating risk and recommend the
  capability replacement plan
- For MIGRATE apps: prefer the platform-genre name (CRM, ERP, MES,
  PLM) over a specific vendor unless the facts cite one

## OUTPUT

Return strict JSON, nothing else. No markdown fences. Keys are the
app ids from the input.

{
  "<appId>": {
    "dispositionRationale": "...",
    "migrationPath": "...",
    "waveJustification": "..."
  },
  ...
}`;
