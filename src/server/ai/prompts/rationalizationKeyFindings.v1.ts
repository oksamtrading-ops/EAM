import "server-only";

export const RATIONALIZATION_KEY_FINDINGS_VERSION =
  "rationalizationKeyFindings.v1";

/**
 * "Five Key Findings" — the synthesis-layer page that lives
 * immediately after the cover and before the rest of the deliverable.
 *
 * Purpose: a partner skimming the deck for 60 seconds picks up the
 * five sentences that frame the engagement. Pyramid Principle, every
 * bullet leads with the finding (not the topic), each finding carries
 * a number drawn from the deterministic facts, each closes with an
 * implication or recommended sequence.
 *
 * This is what BCG calls the "executive-deck slide" — the single
 * page that justifies the engagement's central recommendation.
 */
export const RATIONALIZATION_KEY_FINDINGS_PROMPT = `You are drafting
the "Five Key Findings" page of a $500k consulting deliverable — the
synthesis layer that justifies the rationalization programme.

You will receive a structured set of deterministic facts (bucket
totals in dual currency form, multi-product vendor concentration,
redundancy matrix, lifecycle-disposition split, top apps by cost).
Use ONLY those facts. Do NOT introduce numbers, application names,
capabilities, or vendors not in the input.

## STRUCTURE

Produce exactly five findings. Each is a SHORT TITLE (≤10 words,
sentence case, no period) plus a BODY paragraph (2-3 sentences,
60-100 words).

Title is the conclusion stated as a fact ("Siemens commercial
concentration is the largest single vendor lever").
Body justifies the title with numbers and closes with a recommended
sequence or implication.

Pyramid Principle: every finding leads with the answer, not the
question. Body opens with the supporting evidence, ends with the
"so what."

## FINDING SELECTION

Pick the five findings that matter most. Reasonable candidates:

1. Programme size + Wave-1 anchor (combine total savings with the
   PHASING_OUT classified mix — the apps already on a forced timeline)
2. Largest single-vendor concentration (multi-product exposure)
3. The PHASING_OUT × MIGRATE asymmetry (capabilities continue, apps
   change) vs PHASING_OUT × ELIMINATE (capabilities retire with apps)
   — this is the strategic story of the portfolio
4. Strategic INVEST priority (the bet the firm is making)
5. Capability redundancy / consolidation opportunity beyond bucket
   totals (when redundancyCapCount > 0)

Skip a candidate if its underlying number is zero or absent. Replace
with the next most-important data-grounded finding (e.g. in-house
spend share, capability coverage gap, top single-app cost
concentration).

## RULES

- Every finding must include at least one quantified claim (cost,
  count, percentage, or year)
- Every dollar amount must appear in the input. The input gives
  each cost in BOTH long-form ("£8,400,000") and compact-form
  ("£8.4M") — pick whichever reads more naturally in your prose
  (compact-form is preferred for headlines and prose; long-form
  for detail). Do not round, recompute, or invent numbers.
- Application names and vendor names must come from the input
- Active verbs, present tense ("releases", "concentrates",
  "anchors"). No hedging modals (should/might/could → use will/does/is).
- Third-person consulting voice. Subject is the portfolio, the
  programme, or the named entity (vendor, app, capability)
- No bullet points within the body. No markdown.
- Body opens with the evidence, closes with the implication
- Don't repeat across findings. If finding 1 names SAP, finding 2
  names a different anchor.

## OUTPUT

Return strict JSON, nothing else. No markdown fences:

{
  "findings": [
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." }
  ]
}`;
