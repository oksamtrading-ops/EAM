import "server-only";

export const RATIONALIZATION_BUCKET_NARRATIVES_RUBRIC_VERSION =
  "rationalizationBucketNarratives.v1";

/** Judge rubric for the Bucket Narratives LLM call. Pinned to
 *  the agent's prompt at
 *  src/server/ai/prompts/rationalizationBucketNarratives.v1.ts. */
export const RATIONALIZATION_BUCKET_NARRATIVES_RUBRIC = `You are an
evaluator scoring the Bucket Narratives LLM call output for an
Application Rationalization Plan. Output is a JSON object with four
keys (ELIMINATE / MIGRATE / INVEST / TOLERATE), each containing
{ governingThought, whyNow[3], whatItMeans, action }. Regression
detection, not generic quality assessment.

## SOURCE-OF-TRUTH (verbatim from the agent's prompt)

For each bucket:
- governingThought: one complete sentence stating the answer (not the topic).
  Must contain a number.
- whyNow: 3 evidence bullets, ≤25 words each. Cite app names from input top5.
- whatItMeans: two sentences naming freed capacity + gating dependency.
- action: one imperative sentence with a present-tense verb and time reference.
- Every dollar amount must appear in input. Dual-form acceptable (long + compact).
- Active verbs, present tense, third-person consulting prose.
- No hedging modals (should/might/could → use will/does/is).
- For TOLERATE: emphasize what's working, why holding is the right call.
- For INVEST: emphasize the strategic case for spending more, not the cost.
- LIFECYCLE-DISPOSITION TENSION: when MIGRATE or ELIMINATE buckets contain
  PHASING_OUT apps, whyNow MUST surface the asymmetry — PHASING_OUT × MIGRATE
  means capability continues but app changes; PHASING_OUT × ELIMINATE means
  capability retires with the app.
- Empty buckets return "—" for all four fields.

## YOUR JOB: score the agent output on four 0-10 dimensions

### 1. Groundedness — numbers/names verifiable in input
For each bucket's prose, every dollar amount, app name, vendor, capability
must appear in the input's bucket facts. Names not in the input are hallucinations.
- 9/10: all 4 buckets have verifiable citations
- 5/10: 1-2 unverifiable references across all buckets
- 2/10: ≥3 invented citations or rationale references attributes not in input

### 2. Completeness — required structure populated
- 9/10: all 4 buckets have all 4 fields populated; whyNow always 3 bullets;
  empty buckets correctly return "—"
- 5/10: 1 missing field or 1 bucket with wrong "—" handling
- 2/10: ≥2 missing required fields, or fields blank-string instead of "—" when empty

### 3. Format — schema + structural rules
- 9/10: governingThought contains a number and is one sentence; whyNow bullets ≤25 words;
  no markdown; no bullet points outside whyNow array; valid JSON shape
- 5/10: 1-2 violations (governingThought without number, whyNow >25 words)
- 2/10: ≥3 violations or structurally broken JSON

### 4. Voice — bucket-specific register + lifecycle-disposition tension
THIS IS THE HIGH-SIGNAL DIMENSION.
- 9/10:
  - ELIMINATE: focuses on retirement, freed capacity, sunset gating
  - MIGRATE: focuses on capability continuity + platform modernization
  - INVEST: focuses on strategic spend, NOT on cost-as-waste
  - TOLERATE: focuses on what's working + steady-state operations
  - When PHASING_OUT apps present in MIGRATE or ELIMINATE: whyNow names the
    asymmetry explicitly (capability continues vs capability retires)
  - Active verbs, present tense, no hedging modals
- 5/10: bucket register correct but lifecycle-disposition tension absent when applicable
- 2/10: register inverted (TOLERATE describes problems; INVEST framed as cost-waste);
  or 3+ hedging modals present

## ANTI-PATTERNS TO PENALIZE EXPLICITLY

- DO NOT reward "see governing thought below" or other meta-references between sections.
  Each field stands on its own.
- DO NOT mark down terse whyNow bullets — ≤25 words is the rule, shorter is better.
- DO penalize generic descriptors ("well-established platform", "strategic system")
  that don't cite specific facts from input.
- DO NOT penalize compact-form currency — "£4.6M" is preferred over "£4,580,000" in prose.

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
  "reasoning": "One paragraph (≤4 sentences) citing specific phrases from at least 2 buckets."
}

"confidenceCalibration" slot reused for the "voice" dimension on this rubric.

Be honest.`;
