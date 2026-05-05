import "server-only";

export const RATIONALIZATION_KEY_FINDINGS_RUBRIC_VERSION =
  "rationalizationKeyFindings.v1";

/** Judge rubric for the Five Key Findings synthesis-layer LLM
 *  call. Pinned to the agent's prompt at
 *  src/server/ai/prompts/rationalizationKeyFindings.v1.ts. */
export const RATIONALIZATION_KEY_FINDINGS_RUBRIC = `You are an
evaluator scoring the "Five Key Findings" LLM call output for the
synthesis layer of an Application Rationalization Plan. Output is
a JSON object: { "findings": [{ title, body }, ... 5 items] }.
Regression detection, not generic quality assessment.

## SOURCE-OF-TRUTH (verbatim from the agent's prompt)

- Exactly 5 findings.
- Each finding: SHORT TITLE (≤10 words, sentence case, no period) + BODY paragraph
  (2-3 sentences, 60-100 words).
- Title is the conclusion stated as a fact, not the question
  ("Siemens commercial concentration is the largest single vendor lever").
- Body opens with evidence, ends with the "so what" / sequencing implication.
- Pyramid Principle: each finding leads with the answer.
- Every finding must include at least one quantified claim (cost, count, %, year).
- Every dollar amount must appear in input (dual-form acceptable).
- Application/vendor names must come from input.
- Active verbs, present tense, no hedging modals.
- Don't repeat across findings — if finding 1 names SAP, finding 2 names a different anchor.
- Findings should cover (in approximate order): programme size + Wave-1 anchor; vendor
  concentration; PHASING_OUT × MIGRATE/ELIMINATE asymmetry (when applicable); INVEST
  priority; capability redundancy (when redundancyCapCount > 0).

## YOUR JOB: score the agent output on four 0-10 dimensions

### 1. Groundedness — numbers/names verifiable in input
- 9/10: every cited cost, count, percentage, app name, vendor matches the input
  (compact or long form acceptable)
- 5/10: 1 finding cites an unverifiable number (paraphrase close enough to a fact)
- 2/10: ≥2 invented numbers, or a finding cites an app/vendor not in the input

### 2. Completeness — required coverage + structure
- 9/10: 5 findings, each with title + body; titles ≤10 words; bodies 60-100 words;
  every body cites a number; topics span programme size + concentration + asymmetry +
  INVEST + redundancy (or substitutes when one signal is absent)
- 5/10: 4 findings instead of 5, OR 1 body without a number, OR 2 findings on the
  same topic
- 2/10: ≥3 of: missing findings; bodies < 30 words or > 200 words; ≥2 findings with
  no quantified claim

### 3. Format — schema + structural rules
- 9/10: valid JSON {findings: [{title, body}]}; titles sentence case no period; bodies
  prose without bullets; no markdown
- 5/10: 1-2 violations
- 2/10: structurally broken JSON or markdown bullets in body

### 4. Voice — title is recommendation-shaped + body closes with implication
THIS IS THE HIGH-SIGNAL DIMENSION. Read titles carefully.
- 9/10: every title is a finding-as-fact ("Siemens concentration creates £8.6M
  exposure"); every body ends with a "so what" — recommended sequence, anchor
  point, or implication for action
- 5/10: 1-2 titles are descriptive ("Programme targets £39.1M savings") rather
  than finding-shaped; or 1-2 bodies end on data instead of implication
- 2/10: ≥3 titles announce data ("Bucket totals of TIME analysis"); bodies
  read as fact-restatement without recommended action

## ANTI-PATTERNS TO PENALIZE EXPLICITLY

- DO NOT reward titles that re-state the topic of the finding ("Vendor concentration
  analysis"). Penalize as low voice.
- DO NOT reward bodies that close on a fact ("This represents 20% of total spend.")
  with no recommended sequence. Penalize as low voice.
- Penalize duplicate findings that re-anchor the same fact (e.g. two findings on
  Siemens concentration).
- DO NOT penalize compact-form currency ("£8.6M") — preferred over long-form in headlines.

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
  "reasoning": "One paragraph (≤4 sentences) quoting specific titles + body phrases."
}

"confidenceCalibration" slot reused for the "voice" dimension.

Be honest.`;
