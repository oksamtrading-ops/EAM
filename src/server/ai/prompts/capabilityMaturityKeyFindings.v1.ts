import "server-only";

export const CAPABILITY_MATURITY_KEY_FINDINGS_VERSION =
  "capabilityMaturityKeyFindings.v1";

/** "Five Key Findings" synthesis-layer page for the Capability
 *  Maturity Assessment. Mirrors the rationalization Five Key
 *  Findings prompt's Pyramid-Principle shape, pivoted to
 *  maturity-debt vocabulary. */
export const CAPABILITY_MATURITY_KEY_FINDINGS_PROMPT = `You are
drafting the "Five Key Findings" page of a $500k consulting
deliverable — the synthesis layer of a Capability Maturity
Assessment. The findings frame the engagement.

You will receive structured deterministic facts (total capabilities,
assessment coverage, importance × maturity matrix counts, L1
rollups, action-class band sizes, top priority gaps, top unassessed
L1, workspace-specific risk signals).

Use ONLY those facts. Do NOT introduce capability counts,
capability names, L1 domain names, or maturity levels not in
the input. Capability counts are EXACT-MATCH — no "approximately
12 capabilities".

## STRUCTURE

Produce exactly five findings. Each is:
- A SHORT TITLE (≤10 words, sentence case, no period). The title
  is a finding stated as a fact ("Engineering & Product Development
  domain owns the largest maturity gap").
- A BODY paragraph (2-3 sentences, 60-100 words). Body opens with
  the supporting evidence, ends with the recommended sequencing
  or implication.

Pyramid Principle: every finding leads with the answer.

## FINDING SELECTION

Pick the five findings that matter most. Reasonable candidates:

1. **Programme size + Wave-1 anchor** — combine total capabilities
   below target with the lift-to-target band size and the top L1
   gap concentration. This is the headline finding.

2. **L1 concentration finding** — which L1 domain owns the
   largest cumulative gap-levels. Equivalent of vendor
   concentration in rationalization.

3. **Coverage finding** — when assessmentCoverageRatio < 0.8 OR
   when topUnassessedL1 has share > 30%, this becomes a critical
   finding. When coverage is < 0.6 (full doc not generated; this
   prompt won't run in that case), the Baseline Report path
   handles instead.

4. **Strategic-importance × maturity asymmetry** — name the
   CRITICAL-at-INITIAL/DEVELOPING count vs OPTIMIZING-at-LOW count.
   Surfaces "the portfolio is overserving the wrong things and
   underserving the right ones" when both populations exist.

5. **Application-readiness finding** — bridges to rationalization.
   Of priority-lift capabilities (CRITICAL/HIGH importance, current
   < target), what fraction have applications mapped (execution-
   ready) vs are orphaned (capability uplift requires standing up
   new tooling).

Skip a candidate if its underlying signal is empty (e.g. no
Reassess band → skip the asymmetry finding; replace with the
next-highest-priority data-grounded finding such as
capabilities-without-owners or top L1 with the most NOT_ASSESSED
capabilities).

## RULES

- **Produce exactly five findings.** Not four, not six.
- **Pluralization must agree with counts.** "1 capability" never
  "1 capabilities". "2 capabilities sit" never "2 capability sits".
  Verbs agree with subjects: "1 capability is", "2 capabilities are".
- Every finding must include at least one quantified claim
  (capability count, percentage, gap-level count, or domain count).
- Capability names, L1 domain names, maturity levels must come
  from the input.
- Active verbs, present tense ("the portfolio carries", "the
  priority lift concentrates", "the L1 domain owns"). No hedging
  modals.
- Third-person consulting voice. Subject is the portfolio, the
  programme, or the named entity.
- No bullet points within the body. No markdown.
- Body opens with evidence, closes with implication or recommended
  sequence ("anchor the FY27 capability investment plan").
- Don't repeat across findings. If finding 1 names Engineering
  & Product Development, finding 2 names a different anchor.
- **REASSESS STRATEGY DIPLOMATIC RULE**: any finding referencing
  Reassess Strategy capabilities must avoid "wasting", "over-
  engineered", "excessive". Frame as "redirect", "rebalance",
  "reallocate".
- The deliverable does NOT cite money figures. Findings reference
  capability counts + gap-level counts + percentages, not
  investment cost.

## OUTPUT

Return strict JSON, nothing else, no markdown fences:

{
  "findings": [
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." }
  ]
}`;
