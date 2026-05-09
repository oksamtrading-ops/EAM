import "server-only";

export const ARCHITECTURE_ROADMAP_INITIATIVE_DEEP_DIVES_VERSION =
  "architectureRoadmapInitiativeDeepDives.v1";

/** Per-initiative deep-dive prose for the top-N priority
 *  initiatives in an Architecture Roadmap. Mirrors the maturity
 *  per-capability deep-dive shape but pivots from gap-type
 *  classification to dependency-class classification (keystone /
 *  blocked / orphaned / regulatory-cohort / standalone). */
export const ARCHITECTURE_ROADMAP_INITIATIVE_DEEP_DIVES_PROMPT = `You
are drafting per-initiative deep-dive prose for the top-priority
initiatives in an Architecture Roadmap. Each initiative gets four
short paragraphs; together they justify the wave assignment and
stake out the recommended path.

You will receive a structured set of deterministic facts including
per-initiative: id, name, description, category, status, priority,
horizon, wave, ragStatus, progressPct, ownership flags, linked
applications (with TIME disposition + lifecycle), linked
capabilities (with strategic importance + current → target
maturity), dependency edges (depends-on / blocking).

Use ONLY those facts. Do NOT introduce initiative counts, names,
or relations not in the input. Initiative counts are EXACT-MATCH.

## STRUCTURE PER INITIATIVE

Produce **four** fields:

1. **dispositionRationale** — 3-4 sentences (100-150 words)
   explaining why this initiative sits in its wave and what it
   delivers. Cover, in order:
   - Wave assignment + RAG status + progressPct.
   - Strategic value: which capabilities it lifts (name them with
     current → target progression) and which apps it touches
     (name them with TIME disposition + lifecycle).
   - Cross-deliverable bridge: explicitly call out the linked
     dispositions and progressions when populated.

2. **recommendedPath** — 2-3 sentences (60-100 words) classifying
   the initiative type and naming the recommended path:

   **Initiative-type classification rules:**
   - **KEYSTONE**: high in-degree (≥3 things depend on it). The
     gating initiative for its wave. Recommend "load-test
     dependencies before commit; gate the wave on this
     initiative's completion".
   - **BLOCKED**: depends on ≥2 incomplete upstream initiatives.
     Recommend "sequence after upstream completion; protect
     against cascade-slip".
   - **ORPHANED**: no linked apps AND no linked capabilities.
     Recommend "anchor the initiative against a named capability
     or application before commit; confirm the strategic value
     before allocating capacity".
   - **REGULATORY-COHORT**: COMPLIANCE category. Recommend
     "regulatory deadline drives sequencing; non-discretionary".
   - **STANDALONE**: no dependency edges, ≥1 cross-deliverable
     anchor. Recommend "standard programme governance; capability
     and app readiness already mapped".

3. **riskProfile** — 2-3 sentences (60-100 words) naming the
   execution-risk surface and its mitigation. Pick the dominant
   risk class:
   - **Cascade risk**: when the initiative is a keystone, slipping
     it cascades downstream.
   - **Linked-app ELIMINATE risk**: when a linked app is
     PHASING_OUT or ELIMINATE, the initiative's tooling foundation
     has a known sunset; cannot lag the retirement.
   - **Capability-immaturity risk**: when a linked capability is
     at INITIAL or DEVELOPING and the target is OPTIMIZING, the
     lift inside the initiative's scope is steep.
   - **Ownership risk**: hasOwner=false on a Wave-1 initiative.
   - **RAG risk**: ragStatus=AMBER or RED reads as data-grounded
     concern; cite the specific signal.
   Cite ≥1 named application, capability, or downstream initiative.

4. **waveJustification** — 1 sentence (15-30 words) confirming
   the wave assignment and stating why.

   **Wave heuristic** (apply deterministically):
   - **NOW (<12mo)**: horizon=H1_NOW. CRITICAL/HIGH priority +
     dependency-ready (no incomplete upstream).
   - **NEXT (12-24mo)**: horizon=H2_NEXT. HIGH/MEDIUM priority,
     OR CRITICAL but blocked by Wave-1 dependency.
   - **LATER (24-36mo)**: horizon=H3_LATER/BEYOND. Forward
     roadmap; capability-stretch.

## RULES

- Every numeric claim must appear in input. Initiative counts
  EXACT-MATCH. No money figures.
- Initiative names, capability names, application names, TIME
  dispositions, lifecycle states from input only.
- Active verbs, present tense. No hedging modals (should/might/
  could → use will/does/is). Third-person consulting voice.
- No bullet points. No markdown. No headings within prose.
- Don't speculate about timelines or technologies not in facts.
- For CANCELLED initiatives or DECOMMISSION-category initiatives:
  apply the diplomatic voice rule — "redirect", "rebalance",
  "concluded"; never "wasting", "abandoned", "failed".

## OUTPUT

Return strict JSON, no prose, no markdown fences. Keys are
initiative ids from input.

{
  "<initiativeId>": {
    "dispositionRationale": "...",
    "recommendedPath": "...",
    "riskProfile": "...",
    "waveJustification": "..."
  },
  ...
}`;
