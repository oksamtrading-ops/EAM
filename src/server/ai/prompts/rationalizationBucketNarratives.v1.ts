import "server-only";

export const RATIONALIZATION_BUCKET_NARRATIVES_VERSION =
  "rationalizationBucketNarratives.v1";

/**
 * Single LLM call that emits all four TIME-bucket narratives at once
 * (ELIMINATE / MIGRATE / INVEST / TOLERATE) against deterministic
 * facts. One call instead of four — saves cost, reduces hallucination
 * surface, and forces the model to keep the buckets consistent with
 * each other.
 *
 * Pyramid Principle structure per bucket:
 *   - Governing thought (one bold sentence stating the answer)
 *   - Why now (3 evidence bullets)
 *   - What it means (2 sentences of so-what — freed capacity, gating
 *     dependency)
 *   - Recommended action (one imperative sentence)
 */
export const RATIONALIZATION_BUCKET_NARRATIVES_PROMPT = `You are
drafting four bucket-narrative sections for an Application
Rationalization Plan: ELIMINATE, MIGRATE, INVEST, TOLERATE.

You will receive a structured set of deterministic facts. Use ONLY
those facts. Do NOT introduce numbers, application names,
capabilities, or vendors not in the input.

## STRUCTURE PER BUCKET (Pyramid Principle: answer first)

For each of ELIMINATE, MIGRATE, INVEST, TOLERATE, produce four fields:

1. **governingThought** — one complete sentence stating the answer,
   not the topic. Must contain a number (count or dollar amount).
   Example: "Eleven applications, representing $4.2M in annual
   run-cost, deliver low business value against high technical debt
   and warrant decommissioning within twelve months."

2. **whyNow** — three short evidence bullets, ≤25 words each.
   Quantify where the input quantifies; cite app names where the
   input names them. No padding adjectives.

3. **whatItMeans** — two sentences of consequence. Name the freed
   capacity (license $, FTE hours, infra footprint) and the gating
   dependency (data migration, contract cliff, regulatory).

4. **action** — one imperative sentence with a present-tense verb
   and a time reference. Example: "Sunset App A and App B by Q2;
   consolidate App C onto Retained Platform X by Q4."

## RULES

- Numbers must be quoted verbatim from the input. If the input
  says "$2.8M", use that exact string. Do not round, abbreviate,
  or recompute.
- Application names and vendor names must come from the input's
  top5 lists.
- Third-person consulting prose. Active verbs, present tense.
  No hedging modals (should/might/could → use will/does/is).
- No bullet points except in the whyNow array. No markdown.
- If a bucket has zero apps in the input, return all four fields
  as the literal string "—" (em dash) for that bucket.
- For TOLERATE: emphasize what's working and why holding is the
  right call, not what's broken.
- For INVEST: emphasize the strategic case for spending more, not
  the cost. The number is the size of the bet, not the waste.

## OUTPUT

Return strict JSON, nothing else. No markdown fences:

{
  "ELIMINATE": {
    "governingThought": string,
    "whyNow": [string, string, string],
    "whatItMeans": string,
    "action": string
  },
  "MIGRATE": { ... },
  "INVEST": { ... },
  "TOLERATE": { ... }
}
`;
