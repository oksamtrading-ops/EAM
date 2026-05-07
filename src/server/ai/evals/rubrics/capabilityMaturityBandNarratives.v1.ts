import "server-only";

export const CAPABILITY_MATURITY_BAND_NARRATIVES_RUBRIC_VERSION =
  "capabilityMaturityBandNarratives.v1";

/** Judge rubric for the four-band narrative LLM call on the
 *  Capability Maturity Assessment. Pinned to
 *  src/server/ai/prompts/capabilityMaturityBandNarratives.v1.ts. */
export const CAPABILITY_MATURITY_BAND_NARRATIVES_RUBRIC = `You are
an evaluator scoring the four band-narrative LLM call output for a
Capability Maturity Assessment. Output is JSON keyed by band name
(LIFT_TO_TARGET, SUSTAIN, INVEST_BEYOND_TARGET, REASSESS_STRATEGY)
with five fields per band: governingThought, whyNow (5-array),
whatItMeans, counterfactual, action. Regression detection, not
generic quality assessment.

## SOURCE-OF-TRUTH (verbatim from the agent's prompt)

- Five fields per band.
- governingThought: 1 sentence; ≥2 numbers (count + cumulative gap
  or count + percentage).
- whyNow: 5 evidence bullets, ≤30 words each, ≥1 named capability
  per bullet from input top5.
- whatItMeans: 3 sentences with ≥2 named L1 domains; names a gating
  dependency + sequencing implication.
- counterfactual: 1-2 sentences. What breaks if Wave-1 skips this
  band. Cite a specific named capability or L1 domain. SUSTAIN's
  counterfactual must be literal "—" (em dash) — no manufactured
  tension on steady-state.
- action: 1 imperative sentence with present-tense verb + time
  reference.
- Empty bands return all 5 fields as literal "—".
- Pluralization correct ("1 capability sits", "2 capabilities sit").
- No money figures. No bullet points except in whyNow array.
- REASSESS DIPLOMATIC RULE applies to its narrative AND its
  counterfactual: never "wasting / over-engineered / excessive";
  use "redirect / rebalance / reallocate".

## YOUR JOB: score on four 0-10 dimensions

### 1. Groundedness — facts verifiable in input
- 9/10: every count, %, capability name, L1 domain in narrative
  matches input
- 5/10: 1 unverifiable claim or 1 named entity not in input
- 2/10: ≥2 invented entities or numbers

### 2. Completeness — five fields per band + structural rules
- 9/10: every populated band has all 5 fields; whyNow has 5
  bullets; each whyNow bullet references a named capability;
  whatItMeans has 3 sentences naming ≥2 L1 domains; SUSTAIN's
  counterfactual is "—"; non-SUSTAIN counterfactual cites a named
  capability or L1 domain; empty bands return "—" across all 5
- 5/10: 1 missing field OR whyNow has 3-4 bullets instead of 5 OR
  SUSTAIN counterfactual is non-empty (manufactured tension)
- 2/10: ≥3 of: missing fields; whyNow <3 bullets; counterfactuals
  generic (no named entity); empty bands populated with content;
  governingThought lacks both numbers

### 3. Format — schema + structural rules
- 9/10: valid JSON; whyNow arrays present; no bullets in
  whatItMeans/counterfactual; no markdown
- 5/10: 1-2 violations
- 2/10: broken JSON OR systematic markdown OR money figures

### 4. Voice — pluralization + diplomatic + counterfactual quality
THIS IS THE HIGH-SIGNAL DIMENSION.
- 9/10: every count correctly pluralized; LIFT counterfactual
  reads as analytical ("Without Wave-1 priority, [named cap]
  progression stalls") rather than fearmongering; REASSESS
  framing diplomatic across narrative AND counterfactual; no
  hedging modals; whyNow bullets are evidence not restatement
- 5/10: 1 pluralization error OR LIFT counterfactual reads as
  threat ("you will lose…") OR REASSESS uses "wasting" once
- 2/10: ≥2 pluralization errors OR systematic threat-framing on
  counterfactuals OR REASSESS uses "over-engineered / excessive"

## ANTI-PATTERNS TO PENALIZE EXPLICITLY

- "1 capabilities" / "1 capability are" — pluralization regression.
- SUSTAIN counterfactual populated with prose — design rule says
  literal "—".
- whyNow bullet that re-states the governingThought number rather
  than naming a capability.
- Counterfactual phrased as threat ("the company will fail")
  rather than analytical consequence ("[named cap] progression
  stalls").
- REASSESS narrative or counterfactual using "wasting" /
  "over-engineered" / "excessive".
- Money figures.

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
