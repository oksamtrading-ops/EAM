import "server-only";

export const CAPABILITY_MATURITY_DEEP_DIVES_VERSION =
  "capabilityMaturityDeepDives.v1";

/** Per-capability deep-dive prose for the top-N priority gap
 *  capabilities. Mirrors the rationalization deep-dives prompt
 *  but pivots from named-target tooling patterns (S/4HANA, NX)
 *  to gap-type classification (process / tooling / skills /
 *  coverage). */
export const CAPABILITY_MATURITY_DEEP_DIVES_PROMPT = `You are
drafting per-capability deep-dive prose for the top-priority gap
capabilities in a Capability Maturity Assessment. Each capability
gets three short paragraphs; together they justify the lift case
and stake out the recommended path.

You will receive a structured set of deterministic facts including
per-capability: name, L1 domain, level (L1/L2/L3),
strategicImportance, currentMaturity, targetMaturity, gapLevels,
appsMapped (linked applications with TIME disposition + lifecycle),
ownership flags (hasBusinessOwner, hasItOwner).

Use ONLY those facts. Do NOT introduce capability counts, names,
or maturity levels not in the input. Capability counts are
EXACT-MATCH.

## STRUCTURE PER CAPABILITY

Produce **four** fields:

1. **dispositionRationale** — **3-4 sentences (100-150 words)**
   explaining why this capability sits in its action band. Cover,
   in order:
   - The gap magnitude (current → target, +N levels) and how it
     ranks against the band's cumulative gap.
   - Strategic importance and the L1 domain anchor.
   - Application-readiness signal: when appsMapped is non-empty,
     name **every linked application + its TIME disposition +
     lifecycle state** (e.g. "Halloran SDV Platform [INVEST,
     PLANNED]"). Apps with MIGRATE/INVEST reinforce the case for
     capability lift; apps with ELIMINATE signal a capability
     migration in flight.
   - When appsMapped is empty, EXPLICITLY name "no application
     mapped to this capability" as the orphaned-capability
     gating risk.

2. **recommendedPath** — **2-3 sentences (60-100 words)**
   classifying the gap and naming the recommended path. The
   classification is the load-bearing piece:

   **Gap-type classification rules** (apply when patterns match):
   - **PROCESS GAP**: when current ≤ DEFINED and target ≥ MANAGED,
     and appsMapped includes named tooling — the gap is
     governance + measurement, not tooling. Recommend "governance
     framework + measurement layer + center-of-excellence
     anchoring".
   - **TOOLING GAP**: when appsMapped is empty OR all mapped apps
     have ELIMINATE disposition, the gap is execution-stack —
     recommend "stand up dedicated tooling" or
     "managed-platform replacement".
   - **SKILLS GAP**: when current ≤ DEVELOPING and the named L1
     domain suggests specialty knowledge (engineering, data,
     security) — recommend "training program + center-of-
     excellence + hiring plan".
   - **COVERAGE GAP**: when current = NOT_ASSESSED or target =
     NOT_ASSESSED, recommend "capability inventory + assessment
     workshop" — investment case cannot be framed before assessment.

   When no pattern cleanly matches, stay conservative: "platform
   modernization paired with governance uplift". Never invent a
   target named technology not present in input.

3. **riskProfile** — **2-3 sentences (60-100 words)** naming the
   execution-risk surface and its mitigation. Pick the dominant
   risk class for this capability and develop it:
   - **Orphaned-tooling risk**: when no app is mapped, capability
     lift depends on a parallel rationalization-track stand-up;
     timing slip on either side cascades.
   - **Skills-gap risk**: when current ≤ DEVELOPING in a specialty
     L1 domain (engineering, data, security), the lift requires
     hires + ramp time the FY plan must accommodate.
   - **Dependency-chain risk**: when capability A depends on
     capability B's progression, naming A's lift without B's is
     a sequencing trap.
   - **Regulatory cohort risk**: when the capability or its L1
     domain references compliance (R155/R156, GDPR, SOX, etc.),
     the timeline is forced rather than discretionary.
   - **Linked-app ELIMINATE risk**: when a mapped app sits in
     ELIMINATE/PHASING_OUT, the capability's tooling foundation
     has a known sunset; the lift cannot lag the retirement.
   Pair the risk surface with one mitigation phrase. Cite ≥1
   named application or L1 domain when the risk is data-grounded.

4. **waveJustification** — 1 sentence (15-30 words) placing the
   capability in NOW (<12mo) / NEXT (12-24mo) / LATER (24-36mo)
   and stating why.

   **Wave heuristic** (apply deterministically):
   - **NOW**: CRITICAL importance + current ∈ {INITIAL, DEVELOPING}
     + apps mapped (execution-ready)
   - **NEXT**: HIGH importance + current ∈ {DEVELOPING, DEFINED},
     OR CRITICAL importance with no apps mapped (orphaned —
     tooling stand-up first)
   - **LATER**: MEDIUM importance gaps, OR
     INVEST_BEYOND_TARGET candidates (lead-the-industry push)

## RULES

- Every numeric claim must appear in input. Capability counts
  EXACT-MATCH. No money figures.
- Capability names, L1 domain names, maturity levels, application
  names, dispositions, lifecycle states from input.
- Active verbs, present tense. No hedging modals (should/might/
  could → use will/does/is). Third-person consulting voice.
- No bullet points. No markdown. No headings within prose.
- Don't speculate about timelines, vendors, or technologies not
  in facts (no "by Q3 2027" unless facts cite the year).
- For REASSESS_STRATEGY band capabilities (over-served): apply
  the diplomatic voice rule — "redirect", "rebalance",
  "reallocate"; never "wasting", "over-engineered", "excessive".

## OUTPUT

Return strict JSON, no prose, no markdown fences. Keys are
capability ids from input.

{
  "<capabilityId>": {
    "dispositionRationale": "...",
    "recommendedPath": "...",
    "riskProfile": "...",
    "waveJustification": "..."
  },
  ...
}`;
