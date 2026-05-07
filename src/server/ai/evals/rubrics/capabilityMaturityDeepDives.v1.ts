import "server-only";

export const CAPABILITY_MATURITY_DEEP_DIVES_RUBRIC_VERSION =
  "capabilityMaturityDeepDives.v1";

/** Judge rubric for the per-capability deep-dive LLM call on the
 *  Capability Maturity Assessment. Pinned to
 *  src/server/ai/prompts/capabilityMaturityDeepDives.v1.ts. */
export const CAPABILITY_MATURITY_DEEP_DIVES_RUBRIC = `You are an
evaluator scoring the per-capability deep-dive LLM call output for
a Capability Maturity Assessment. Output is JSON keyed by capability
id, each value containing four fields: dispositionRationale,
recommendedPath, riskProfile, waveJustification. Regression detection,
not generic quality assessment.

## SOURCE-OF-TRUTH (verbatim from the agent's prompt)

- Four fields per capability.
- dispositionRationale: 3-4 sentences, 100-150 words. Covers gap
  magnitude (current → target +N levels) + strategic importance +
  L1 domain anchor + application-readiness signal. When apps are
  mapped, name EVERY linked app + TIME disposition + lifecycle
  state ("Halloran SDV Platform [INVEST, PLANNED]"). When apps are
  empty, EXPLICITLY name "no application mapped to this capability"
  as orphaned-capability gating risk.
- recommendedPath: 2-3 sentences, 60-100 words. Names the gap-type
  classification (process / tooling / skills / coverage). Never
  invents target named technology not present in input.
- riskProfile: 2-3 sentences, 60-100 words. Picks dominant risk
  class: orphaned-tooling / linked-app ELIMINATE / skills-gap /
  dependency-chain / regulatory cohort. Cites ≥1 named application
  or L1 domain.
- waveJustification: 1 sentence, 15-30 words. NOW / NEXT / LATER
  per the heuristic.
- Pluralization correct. No money figures.
- REASSESS DIPLOMATIC RULE applies for over-served capabilities.

## WAVE HEURISTIC (verbatim)

- NOW: CRITICAL importance + current ∈ {INITIAL, DEVELOPING} +
  apps mapped (execution-ready)
- NEXT: HIGH importance + current ∈ {DEVELOPING, DEFINED}, OR
  CRITICAL importance with no apps mapped (orphaned)
- LATER: MEDIUM importance OR INVEST_BEYOND_TARGET candidates

## YOUR JOB: score on four 0-10 dimensions

### 1. Groundedness — facts verifiable in input
- 9/10: every cited capability name, L1 domain, application name,
  TIME disposition, lifecycle state matches input. dispositionRationale
  names every mapped app verbatim.
- 5/10: 1 unverifiable detail or 1 missing app from a multi-app
  capability
- 2/10: ≥2 invented apps / dispositions / lifecycle states; or
  inventing a target technology (e.g. "Salesforce Lightning") not
  in input

### 2. Completeness — four fields + structural rules
- 9/10: every capability has all 4 fields with content; rationale
  names every mapped app + TIME disposition + lifecycle; orphaned
  capabilities explicitly call out "no application mapped"; risk
  profile picks a dominant risk class and names ≥1 entity; wave
  matches the heuristic
- 5/10: 1 missing field OR rationale skips one mapped app OR risk
  profile generic (no named entity) OR wave drifts from heuristic
- 2/10: ≥3 of: missing fields; rationale skips ≥2 mapped apps;
  risk profile is generic boilerplate; wave assignment violates
  heuristic; orphaned-capability framing absent for orphans

### 3. Format — schema + structural rules
- 9/10: valid JSON keyed by capability id; prose without bullets;
  no markdown; word counts in range
- 5/10: 1-2 violations
- 2/10: broken JSON OR systematic markdown OR money figures cited

### 4. Voice — gap-type classification + named pattern + risk
   substance + diplomatic
THIS IS THE HIGH-SIGNAL DIMENSION.
- 9/10: recommendedPath names the gap-type classification
  explicitly (process / tooling / skills / coverage gap); risk
  profile substantive with named-entity grounding (not boilerplate
  "execution risk requires monitoring"); REASSESS framing
  diplomatic where applicable; pluralization correct; no hedging
  modals
- 5/10: 1-2 capabilities lack gap-type classification, OR risk
  profile generic for 1-2 capabilities, OR 1 hedging modal
  ("might require")
- 2/10: ≥3 capabilities lack gap-type classification; ≥3 risk
  profiles are generic; systematic hedging; REASSESS uses
  "wasting / over-engineered"

## ANTI-PATTERNS TO PENALIZE EXPLICITLY

- Risk profile that is generic boilerplate ("execution requires
  careful sequencing") with no named entity. Penalize hard.
- Inventing target technologies — e.g. naming "Salesforce Industries
  Cloud" when input only references "Salesforce". Penalize as
  groundedness failure.
- dispositionRationale that fails to name every linked app+TIME
  disposition when apps are mapped. Penalize as completeness gap.
- Orphaned capabilities (apps empty) where rationale fails to use
  the orphaned-capability gating-risk framing.
- Wave assignment that contradicts the heuristic (e.g. CRITICAL +
  INITIAL + apps mapped placed in NEXT instead of NOW).
- "1 capabilities" pluralization regression.
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
