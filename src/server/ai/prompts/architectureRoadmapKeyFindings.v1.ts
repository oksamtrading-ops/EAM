import "server-only";

export const ARCHITECTURE_ROADMAP_KEY_FINDINGS_VERSION =
  "architectureRoadmapKeyFindings.v1";

/** "Five Key Findings" synthesis-layer page for the Architecture
 *  Roadmap deliverable. Mirrors the maturity Five Key Findings
 *  Pyramid-Principle shape but anchors on initiative + dependency
 *  + cross-deliverable bridge data. */
export const ARCHITECTURE_ROADMAP_KEY_FINDINGS_PROMPT = `You are
drafting the "Five Key Findings" page of a $500k consulting
deliverable — the synthesis layer of an Architecture Roadmap.

You will receive structured deterministic facts (total
initiatives, wave breakdown, RAG mix, dependency network summary,
top initiatives by composite priority weight, cross-deliverable
coverage signals, workspace-specific risk signals).

Use ONLY those facts. Do NOT introduce initiative counts,
initiative names, capability names, application names, or RAG
states not in the input. Initiative counts are EXACT-MATCH —
no "approximately 12 initiatives".

## STRUCTURE

Produce exactly five findings. Each is:
- A SHORT TITLE (≤10 words, sentence case, no period). The title
  is a finding stated as a fact ("S/4HANA Cutover anchors the
  Wave-1 dependency chain").
- A BODY paragraph (3-4 sentences, 100-150 words). Body opens
  with the supporting evidence, develops a second analytical
  lens (sequencing / dependency / readiness / risk / cross-
  deliverable), names ≥2 distinct entities (initiative,
  capability, application, or L1 domain), and ends with the
  recommended sequencing or implication.

Pyramid Principle: every finding leads with the answer.

## FINDING SELECTION

Pick the five findings that matter most. Reasonable candidates:

1. **Programme size + Wave-1 anchor** — combine total initiative
   count with the NOW wave size and the top initiative by
   composite priority weight. This is the headline finding.

2. **Dependency network finding** — keystone initiative (highest
   in-degree); how many downstream initiatives depend on it; what
   slipping it cascades.

3. **Cross-deliverable bridge finding** — when fullBridgeShare > 0,
   highlight the integration: % of initiatives that map to BOTH
   applications and capabilities. This is the platform's
   differentiation; surface it explicitly.

4. **Wave-RAG asymmetry** — when the NOW wave contains AMBER or
   RED initiatives, name the count and the implication; the
   Wave-1 commitment is at risk before it ships.

5. **Cross-wave dependency risk** — when initiatives in NEXT or
   LATER depend on initiatives in NOW that haven't completed,
   surface the sequence integrity risk.

Skip a candidate if its underlying signal is empty (e.g. no
dependency edges → skip the keystone finding; replace with the
next-highest-priority data-grounded finding such as
orphaned-initiatives or wave1-without-owner).

## RULES

- **Produce exactly five findings.** Not four, not six.
- **Pluralization must agree with counts.** "1 initiative" never
  "1 initiatives". "2 initiatives sit" never "2 initiative sits".
- Every finding must include at least one quantified claim
  (initiative count, percentage, edge count, or in-degree count).
- Initiative names, capability names, application names, L1
  domain names must come from the input.
- Active verbs, present tense ("the roadmap concentrates", "the
  keystone initiative anchors"). No hedging modals.
- Third-person consulting voice. Subject is the roadmap, the
  programme, or the named entity.
- No bullet points within the body. No markdown.
- Body opens with evidence, closes with implication or recommended
  sequence ("anchor the FY26 capital plan").
- Don't repeat across findings. If finding 1 names Wave 1, finding
  2 names a different anchor.
- **CANCELLED-INITIATIVE DIPLOMATIC RULE**: any finding referencing
  CANCELLED or DECOMMISSION-category initiatives must avoid
  "wasted", "abandoned", "failed". Frame as "redirected",
  "rebalanced", "concluded".
- The deliverable does NOT cite money figures.

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
