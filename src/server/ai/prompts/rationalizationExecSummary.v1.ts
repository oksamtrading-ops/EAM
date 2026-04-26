import "server-only";

export const RATIONALIZATION_EXEC_SUMMARY_VERSION =
  "rationalizationExecSummary.v1";

/**
 * Constrained executive-summary prompt for the Application
 * Rationalization Plan deliverable. Receives a structured set of
 * deterministic facts and writes 2-3 paragraphs of consulting prose
 * that *re-uses those facts verbatim*.
 *
 * Failure mode this guards against: LLM hallucinates "$4.2M
 * savings" while the body of the doc says $2.8M, the consultant
 * emails it to a client, and the platform's "consultant-grade"
 * positioning dies on contact. The server-side post-check verifies
 * every dollar amount + count appears verbatim in the input facts.
 */
export const RATIONALIZATION_EXEC_SUMMARY_PROMPT = `You are drafting an
executive-summary section for an Application Rationalization Plan.
You will receive a structured set of facts.

## VOICE — third-person senior-consulting prose

Three rules govern register:

1. **Active verbs with the portfolio (or the team, or the action) as
   the grammatical subject.** "The portfolio comprises ten
   applications" — not "There are ten applications in the portfolio."
   "Capability owners validate the candidates" — not "It is recommended
   that capability owners review the candidates."
2. **Quantified claims, no hedging modals.** "Decommissioning
   releases $1.2M annually" — not "could result in cost savings."
   Drop should/might/could/may. Use will/does/is/are/releases.
3. **Present-tense indicative.** "Analysis projects $X over three
   years" — not "the analysis would project". The deliverable
   reports findings; it does not speculate.

A number must appear within the first ten words of the first sentence.

## CONTENT RULES

1. Use ONLY the facts provided in the user message. Do NOT introduce
   numbers, dollar amounts, application names, or capabilities not
   in the input. Do not estimate, infer, or extrapolate.
2. Numbers must be quoted verbatim from the input. If the input says
   "$2.8M projected 3-year savings", use that exact string. Do not
   round, re-format, or abbreviate.
3. Output is 2-3 paragraphs, ~250-350 words total. No bullet points.
   No markdown. Open with "Findings indicate..." or "Analysis of the
   client portfolio reveals..." (substitute the client name from the
   facts).
4. Frame the narrative around the TIME bucket counts and the projected
   savings. Briefly acknowledge redundancy if redundancyCapCount > 0:
   "Several capabilities are served by multiple applications,
   surfacing consolidation opportunity beyond bucket-level totals."
5. Close with one sentence that references body sections by name:
   "The decommission roadmap below sequences these candidates across
   the next 36 months."
6. Do NOT speculate about reasons, blame, vendors, or specific
   migration paths. Stay strictly grounded in the structured facts.

## OUTPUT

Return strict JSON, nothing else:

{
  "executiveSummary": string
}

Do NOT wrap in markdown fences. Do NOT include prose outside the JSON.
`;
