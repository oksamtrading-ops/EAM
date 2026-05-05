import "server-only";

export const RATIONALIZATION_DEEP_DIVES_RUBRIC_VERSION =
  "rationalizationDeepDives.v1";

/** Judge rubric for the Per-App Deep Dives LLM call. Pinned to
 *  the agent's prompt at
 *  src/server/ai/prompts/rationalizationDeepDives.v1.ts. */
export const RATIONALIZATION_DEEP_DIVES_RUBRIC = `You are an
evaluator scoring the Per-Application Deep Dives LLM call output.
Output is a JSON map keyed by appId, each entry containing
{ dispositionRationale, migrationPath, waveJustification }.
Regression detection, not generic quality assessment.

## SOURCE-OF-TRUTH (verbatim from the agent's prompt)

For each top-cost application:
- dispositionRationale: 2-3 sentences (50-90 words) explaining why the app sits in
  its TIME bucket. References BV, TH, lifecycle from facts. When capabilityAlternatives
  is empty, notes "no alternative app in the portfolio." When non-empty, surfaces
  consolidation opportunity.
- migrationPath: 1-2 sentences (30-60 words) naming the recommended path.
  Pattern triggers (NAME THE TARGET):
    - SAP ECC / R/3 → "S/4HANA conversion"
    - Teamcenter (legacy) → "Teamcenter X / cloud"
    - On-prem CRM (Dynamics legacy / Siebel) → "Dynamics 365 cloud"
    - On-prem PLM with NX present → "consolidate onto NX"
    - Legacy AS/400 / iSeries → "cloud-native catalog platform"
    - Legacy MES → "MOM-platform consolidation (Apriso / Opcenter)"
    - Bespoke on-prem → "managed-platform replacement"
  When no pattern matches, stay conservative: "platform modernization" beats
  inventing a target.
- waveJustification: 1 sentence (15-30 words) placing in NOW (<12mo) / NEXT (12-24mo)
  / LATER (24-36mo). PHASING_OUT lifecycle drives NOW; ACTIVE drives NEXT or LATER
  depending on disposition; PLANNED INVEST is a forward decision (LATER unless cost dictates).
- Every dollar amount must appear in input (dual-form acceptable).
- Application/vendor/capability names from input.
- Active verbs, present tense, no hedging modals.
- For ELIMINATE apps with no capability alternative: EXPLICITLY name the gap as
  the gating risk and recommend the capability replacement plan.
- For MIGRATE apps: prefer platform-genre name (CRM, ERP, MES, PLM) over a
  specific vendor unless facts cite one.

## YOUR JOB: score the agent output on four 0-10 dimensions

### 1. Groundedness — numbers/names verifiable in input
- 9/10: every cost, BV, TH, lifecycle, capability, alternative-app reference verifiable
- 5/10: 1 unverifiable reference across all deep dives
- 2/10: ≥2 invented numbers, capabilities, or alternative-app names; or a deep dive
  invents a target outside the pattern set without falling back to "platform modernization"

### 2. Completeness — required structure populated
- 9/10: every input app has all 3 fields populated; word counts in spec
  (rationale 50-90; migrationPath 30-60; waveJustification 15-30); ELIMINATE apps
  without alternatives explicitly name the capability gap
- 5/10: 1 app missing a field, or 2 word-count violations
- 2/10: ≥2 missing fields; ELIMINATE apps without alternatives don't name the gap

### 3. Format — schema + structural rules
- 9/10: valid JSON keyed by appId; no markdown; no bullets; no headings; complete
  sentences in each field
- 5/10: 1 violation (markdown bullets in path; heading inside rationale)
- 2/10: structurally broken JSON or missing required keys

### 4. Voice — named-target + capability-alternative reasoning
THIS IS THE HIGH-SIGNAL DIMENSION. Read migrationPath and capability mapping carefully.
- 9/10:
  - Pattern-matched apps name the specific target (S/4HANA, NX, MOM platform)
  - Non-matched apps fall back to conservative "platform modernization" — no inventions
  - dispositionRationale surfaces capability-alternative reasoning when present
    ("CATIA V5 and NX provide alternative coverage")
  - waveJustification cites the lifecycle driver ("PHASING OUT lifecycle drives NOW")
- 5/10: 1-2 pattern-matched apps stay vague ("modern ERP system" instead of "S/4HANA");
  or capability-alternatives in input but rationale ignores them
- 2/10: ≥3 vague targets; or invented targets outside pattern set ("custom blockchain
  platform")

## ANTI-PATTERNS TO PENALIZE EXPLICITLY

- DO NOT reward "modern ERP system" when input has SAP ECC; the prompt explicitly
  requires S/4HANA naming on that pattern.
- DO NOT reward filler statements ("This system is critical to operations.") that
  don't cite specific facts.
- DO penalize when the recommended path invents a vendor/product not in the input
  and outside the pattern triggers (e.g., recommends specific Salesforce CPQ when
  input has no Salesforce).
- DO NOT penalize migrationPath that abstains with "platform modernization" — that
  is the documented conservative fallback.

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
  "reasoning": "One paragraph (≤4 sentences) quoting specific phrases from at least 2 apps' deep dives."
}

"confidenceCalibration" slot reused for the "voice" dimension.

Be honest.`;
