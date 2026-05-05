import "server-only";

/**
 * Shared fact-grounding utilities for deliverable LLM outputs.
 *
 * The rationalization deliverable verifies LLM-emitted dollar
 * amounts against the deterministic input facts (1.5% tolerance,
 * accommodating compact-form rounding e.g. "£4.58M" vs "£4.6M").
 * The maturity deliverable will verify capability counts and
 * gap-level claims with EXACT-MATCH semantics — there's no
 * "approximately 12 capabilities" tolerance to grant.
 *
 * Different verification rules → different functions. Shared:
 * the numeric-token parser. The parser is the load-bearing
 * piece; the verification policy on top differs by domain.
 */

/** Parse a money or count token into its numeric value.
 *  Money:  "£8.4M" / "£8,400,000" / "$2.5B" / "€48k"
 *  Count:  "12" / "1,200" / "12 capabilities" (caller strips trailing words)
 *  Returns null when the input doesn't parse as a number. */
export function parseNumericToken(s: string): number | null {
  // Money form: currency-symbol prefix optional.
  const moneyMatch = s.match(/[$€£¥]\s*([\d.,]+)\s*([KkMmBb])?/);
  if (moneyMatch) {
    const digits = moneyMatch[1]!.replace(/,/g, "");
    const num = parseFloat(digits);
    if (!isFinite(num)) return null;
    const suffix = moneyMatch[2]?.toUpperCase();
    const mult =
      suffix === "K" ? 1_000 :
      suffix === "M" ? 1_000_000 :
      suffix === "B" ? 1_000_000_000 :
      1;
    return num * mult;
  }
  // Plain numeric form: integer or decimal, with optional commas.
  const plainMatch = s.match(/^([\d,]+(?:\.\d+)?)$/);
  if (plainMatch) {
    const digits = plainMatch[1]!.replace(/,/g, "");
    const num = parseFloat(digits);
    if (!isFinite(num)) return null;
    return num;
  }
  return null;
}

/** Verify every dollar amount in `text` matches a value in
 *  `allowedCosts` within 1.5% tolerance. Hallucinated numbers
 *  (any value not within tolerance of an allowed value) fail.
 *
 *  Tolerance covers the gap between long-form ("£4,580,000") and
 *  compact-form ("£4.6M") rounding so the LLM can pick the
 *  prose-natural form without failing the post-check. */
export function verifyDollarAmounts(
  text: string,
  allowedCosts: string[]
): boolean {
  const allowedNumbers = allowedCosts
    .map(parseNumericToken)
    .filter((n): n is number => n !== null);
  if (allowedNumbers.length === 0) {
    // No allowed costs known — any money-shaped token in the text
    // is a hallucination.
    return !/[$€£¥]\s*[\d.,]+\s*(?:[KkMmBb])?/.test(text);
  }
  const pattern = /[$€£¥]\s*[\d.,]+\s*(?:[KkMmBb])?/g;
  const matches = text.match(pattern) ?? [];
  for (const m of matches) {
    const n = parseNumericToken(m);
    if (n === null) return false;
    const ok = allowedNumbers.some((a) =>
      a === 0 ? n === 0 : Math.abs(n - a) / Math.max(a, 1) < 0.015
    );
    if (!ok) return false;
  }
  return true;
}

/** Verify every capability/maturity count in `text` matches a
 *  value in `allowedCounts` exactly. No tolerance: "approximately
 *  12 capabilities" is not a thing the deliverable should emit.
 *
 *  Scope: integer counts + percentages (e.g. "12 capabilities",
 *  "20% of run-cost"). Money tokens are NOT validated by this
 *  function — use `verifyDollarAmounts` for those.
 *
 *  Edge case: numeric tokens inside named entities (e.g.
 *  "SAP ECC 6.0" contains "6.0") are excluded by requiring the
 *  number be followed by a recognized suffix (capabilities,
 *  applications, %, levels, etc.) or be standalone within
 *  whitespace. */
export function verifyMaturityNumbers(
  text: string,
  allowedCounts: number[]
): boolean {
  const allowed = new Set(allowedCounts);
  // Match: leading-digit-cluster (with optional commas) followed by
  // either a percentage, a maturity-domain noun, or a level word.
  // Excludes version-number-shaped patterns like "ECC 6.0" by
  // requiring the qualifying suffix.
  const pattern =
    /(\d{1,3}(?:,\d{3})*)\s*(?:%|capabilities|capability|applications|application|levels|level|gap|gaps|domains|domain|apps|app|orphan(?:ed|s)?|unassessed)/gi;
  const matches: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const n = parseInt(m[1]!.replace(/,/g, ""), 10);
    if (isFinite(n)) matches.push(n);
  }
  for (const n of matches) {
    if (!allowed.has(n)) return false;
  }
  return true;
}
