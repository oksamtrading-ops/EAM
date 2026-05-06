import "server-only";

export const CAPABILITY_MATURITY_BAND_NARRATIVES_VERSION =
  "capabilityMaturityBandNarratives.v1";

/** Band-narrative LLM call for the Capability Maturity Assessment.
 *  Equivalent of bucket narratives in rationalization. Four
 *  action-class bands instead of 5 maturity-level bands —
 *  organized around RECOMMENDED ACTION, not current state. */
export const CAPABILITY_MATURITY_BAND_NARRATIVES_PROMPT = `You are
drafting four action-class band-narrative sections for a Capability
Maturity Assessment: LIFT_TO_TARGET, SUSTAIN, INVEST_BEYOND_TARGET,
REASSESS_STRATEGY.

You will receive a structured set of deterministic facts. Use ONLY
those facts. Do NOT introduce capability counts, capability names,
L1 domains, or maturity levels not in the input.

## ACTION-CLASS DEFINITIONS

- **LIFT_TO_TARGET**: capabilities at CRITICAL or HIGH strategic
  importance with current < target. The investment thesis lives
  here. Largest band by cumulative gap-levels.
- **SUSTAIN**: capabilities at current = target with no flag for
  invest-beyond. Steady-state operations.
- **INVEST_BEYOND_TARGET**: CRITICAL/HIGH importance capabilities
  at current = target = MANAGED. Lead-the-industry candidates;
  the firm wants to push to OPTIMIZING.
- **REASSESS_STRATEGY**: capabilities at current > target OR
  (OPTIMIZING + LOW importance). Over-served — investment is
  out of proportion to strategic value.

## STRUCTURE PER BAND (Pyramid Principle: answer first)

For each band, produce four fields:

1. **governingThought** — one complete sentence stating the answer,
   not the topic. Must contain a number (count or gap-level total).
   Example: "Eight CRITICAL/HIGH capabilities require maturity uplift
   totaling 17 gap-levels; the Engineering & Product Development
   domain owns 60% of the cumulative lift."

2. **whyNow** — three short evidence bullets, ≤25 words each. Cite
   capability names from input top5. No padding adjectives.

3. **whatItMeans** — two sentences of consequence. Name the
   gating dependency (assessment coverage; application readiness;
   owner accountability) and the sequencing implication (Wave 1
   anchor; budget cycle alignment; org-design pre-requisite).

4. **action** — one imperative sentence with a present-tense verb
   and a time reference. Example: "Sequence Wave 1 lift on the
   {top L1 domain} cluster by Q2; commit governance + tooling
   investment in the FY26 budget cycle."

## RULES

- Every numeric claim must appear in the input. Capability counts
  are EXACT-MATCH. The deliverable does NOT cite money figures.
- Capability names, L1 domain names, maturity levels from input.
- Third-person consulting prose. Active verbs, present tense.
  No hedging modals (should/might/could → use will/does/is).
- No bullet points except in the whyNow array. No markdown.
- If a band has zero capabilities in the input, return all four
  fields as the literal string "—" (em dash) for that band.

## BAND-SPECIFIC VOICE RULES

- **LIFT_TO_TARGET**: emphasize the priority lift — the strategic
  case for closing the gap. Reference application readiness when
  the input surfaces it (apps mapped vs orphaned).
- **SUSTAIN**: emphasize what's working and why steady-state
  operation is the disciplined call. Don't manufacture work.
- **INVEST_BEYOND_TARGET**: emphasize the lead-the-industry case;
  the strategic case for pushing past current target. Frame as
  forward investment, not as a gap.
- **REASSESS_STRATEGY** (DIPLOMATIC RULE): this band is politically
  sensitive. Calling out over-engineered, over-served capabilities
  means telling the client past investment was misplaced. Avoid:
  - "wasting"
  - "over-engineered"
  - "excessive"
  - "unjustified"
  Frame instead as:
  - "redirect investment to higher-priority gaps"
  - "rebalance capacity"
  - "reallocate to capabilities at CRITICAL/HIGH importance"
  - Acknowledge prior investment as past-tense fact, not present-
    tense criticism.
  - Recommend reallocation, not retirement.

## OUTPUT

Return strict JSON, nothing else, no markdown fences:

{
  "LIFT_TO_TARGET": {
    "governingThought": string,
    "whyNow": [string, string, string],
    "whatItMeans": string,
    "action": string
  },
  "SUSTAIN": { ... same shape },
  "INVEST_BEYOND_TARGET": { ... same shape },
  "REASSESS_STRATEGY": { ... same shape }
}`;
