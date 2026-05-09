import "server-only";

export const ARCHITECTURE_ROADMAP_WAVE_NARRATIVES_VERSION =
  "architectureRoadmapWaveNarratives.v1";

/** Wave-narrative LLM call for the Architecture Roadmap.
 *  Equivalent of action-class bands in maturity. Three waves
 *  (NOW / NEXT / LATER) — each carries its own governing
 *  thought, evidence, implication, counterfactual, and action. */
export const ARCHITECTURE_ROADMAP_WAVE_NARRATIVES_PROMPT = `You are
drafting three wave-narrative sections for an Architecture
Roadmap: NOW (<12 months), NEXT (12-24 months), LATER (24-36
months).

You will receive a structured set of deterministic facts. Use ONLY
those facts. Do NOT introduce initiative counts, initiative
names, capability names, or application names not in the input.

## WAVE DEFINITIONS

- **NOW**: initiatives at horizon=H1_NOW. Wave-1 — the FY-budget-
  cycle commitment. Where the investment thesis lives.
- **NEXT**: initiatives at horizon=H2_NEXT. Wave-2 — depends on
  Wave-1 outputs; sequencing risk concentrates here.
- **LATER**: initiatives at horizon=H3_LATER or BEYOND. Wave-3 —
  forward roadmap; lighter governance for now.

## STRUCTURE PER WAVE (Pyramid Principle: answer first)

For each wave, produce **five** fields:

1. **governingThought** — one complete sentence stating the answer,
   not the topic. **Must contain ≥2 numbers** (count + dependency
   edge total OR count + RAG-mix percentage). Example: "Seven NOW-
   wave initiatives carry 12 dependency edges; the S/4HANA Cutover
   anchors 5 of them and gates the entire Wave-1 sequence."

2. **whyNow** — **five** short evidence bullets, ≤30 words each.
   **Each bullet must reference ≥1 named initiative from input
   topInitiatives.** No padding adjectives. No restatement of the
   governing thought.

3. **whatItMeans** — **three** sentences of consequence. Name the
   gating dependency (cross-wave dependency, capability-readiness,
   ownership accountability) and the sequencing implication
   (FY budget anchor, capability uplift dependency, decommission
   timing). **Reference ≥2 named initiatives across the three
   sentences.**

4. **counterfactual** — 1-2 sentences. What breaks if the wave
   slips. Cite a specific named initiative or downstream wave
   whose progression depends on this wave's completion. For
   LATER, the counterfactual is light (forward roadmap; no
   downstream wave). Example for NOW: "Without on-time NOW
   completion of S/4HANA Cutover and OTA Platform Stand-up, the
   Customer 360 Consolidation in NEXT cannot anchor on a stable
   ERP master-data layer; the £-shape of the FY27 plan slides
   right by a quarter."

5. **action** — one imperative sentence with a present-tense verb
   and a time reference. Example: "Sequence Wave 1 lift on the
   S/4HANA Cutover keystone by Q2; commit governance + tooling
   investment in the FY26 budget cycle."

## RULES

- **Pluralization must agree with counts.** "1 initiative" never
  "1 initiatives". "2 initiatives sit" never "2 initiative sits".
  Verbs agree with subjects: "1 initiative is", "2 initiatives are".
- Every numeric claim must appear in the input. Initiative counts
  are EXACT-MATCH. The deliverable does NOT cite money figures.
- Initiative names, capability names, application names, L1
  domain names from input only.
- Third-person consulting prose. Active verbs, present tense.
  No hedging modals (should/might/could → use will/does/is).
- No bullet points except in the whyNow array. No markdown.
- If a wave has zero initiatives in the input, return all five
  fields as the literal string "—" (em dash) for that wave.

## WAVE-SPECIFIC VOICE RULES

- **NOW**: emphasize the urgency — the FY budget cycle is the
  forcing function. Reference application-readiness when input
  surfaces it (apps mapped vs orphaned).
- **NEXT**: emphasize the dependency — Wave-2 anchors on Wave-1
  outputs. Surface cross-wave dependency edges by name.
- **LATER**: emphasize the trajectory — forward roadmap;
  capability-stretch initiatives composing on the Wave-1+2
  foundation. Frame as forward investment.
- **CANCELLED INITIATIVES** (rare in roadmap context): if a wave
  contains CANCELLED-status initiatives, frame as "redirected",
  "rebalanced", "concluded"; never "wasted" or "failed".

## OUTPUT

Return strict JSON, nothing else, no markdown fences:

{
  "NOW": {
    "governingThought": string,
    "whyNow": [string, string, string, string, string],
    "whatItMeans": string,
    "counterfactual": string,
    "action": string
  },
  "NEXT": { ... same shape },
  "LATER": { ... same shape (counterfactual lighter) }
}`;
