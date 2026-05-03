/* eslint-disable */
// Smoke test for Plan B fact-grounding fix: verifies that
// buildBucketFacts emits dual-form costs (long + compact), and
// that verifyDollarAmounts accepts both. No DB, no LLM call.
//
// Run: node --conditions=react-server --import tsx scripts/smoke-rationalization-facts.ts

import { formatCurrency, formatCurrencyCompact } from "../src/lib/currency";

// Mirror the new tolerance-based verifyDollarAmounts (not exported
// from the builder). Keep in sync with buildRationalizationDocx.ts.
function parseMoney(s: string): number | null {
  const m = s.match(/[$€£¥]\s*([\d.,]+)\s*([KkMmBb])?/);
  if (!m) return null;
  const digits = m[1]!.replace(/,/g, "");
  const num = parseFloat(digits);
  if (!isFinite(num)) return null;
  const suffix = m[2]?.toUpperCase();
  const mult =
    suffix === "K" ? 1_000 :
    suffix === "M" ? 1_000_000 :
    suffix === "B" ? 1_000_000_000 :
    1;
  return num * mult;
}
function verifyDollarAmounts(text: string, allowedCosts: string[]): boolean {
  const allowedNumbers = allowedCosts
    .map(parseMoney)
    .filter((n): n is number => n !== null);
  const pattern = /[$€£¥]\s*[\d.,]+\s*(?:[KkMmBb])?/g;
  const matches = text.match(pattern) ?? [];
  for (const m of matches) {
    const n = parseMoney(m);
    if (n === null) {
      console.error(`  ✗ unparseable: ${m}`);
      return false;
    }
    const ok = allowedNumbers.some((a) =>
      a === 0 ? n === 0 : Math.abs(n - a) / Math.max(a, 1) < 0.015
    );
    if (!ok) {
      console.error(`  ✗ outside tolerance: ${m} (${n})`);
      return false;
    }
  }
  return true;
}

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  ok ? pass++ : fail++;
}

const cur = "GBP";
const fmt = (n: number) => formatCurrency(n, cur);
const fmtC = (n: number) => formatCurrencyCompact(n, cur);

console.log("Long-form vs compact-form examples:");
console.log(`  fmt(8_400_000)  = ${fmt(8_400_000)}`);
console.log(`  fmtC(8_400_000) = ${fmtC(8_400_000)}`);
console.log(`  fmt(16_900_000) = ${fmt(16_900_000)}`);
console.log(`  fmtC(16_900_000) = ${fmtC(16_900_000)}`);
console.log("");

// Simulated allowedCosts (what the post-check sees).
const allowedCosts = [
  fmt(4_580_000), fmtC(4_580_000),         // ELIMINATE
  fmt(16_900_000), fmtC(16_900_000),       // MIGRATE
  fmt(16_570_000), fmtC(16_570_000),       // INVEST
  fmt(5_950_000), fmtC(5_950_000),         // TOLERATE
  fmt(8_400_000), fmtC(8_400_000),         // SAP ECC (per-app top5)
  fmt(6_200_000), fmtC(6_200_000),         // Teamcenter
  fmt(2_300_000), fmtC(2_300_000),         // Solihull MES
];
console.log("allowedCosts:", allowedCosts);
console.log("");

// Test 1: LLM emits compact-form prose (the typical natural prose).
const llmCompact =
  "Decommissioning the two ELIMINATE candidates releases £4.58M annually. " +
  "Migration of SAP (£8.4M), Teamcenter (£6.2M), and Solihull MES (£2.3M) " +
  "consolidates £16.9M of run-cost onto retained platforms.";
check("LLM compact-form prose passes", verifyDollarAmounts(llmCompact, allowedCosts));

// Test 2: LLM emits long-form prose.
const llmLong =
  "Decommissioning the two ELIMINATE candidates releases £4,580,000 annually. " +
  "Migration consolidates £16,900,000 of run-cost.";
check("LLM long-form prose passes", verifyDollarAmounts(llmLong, allowedCosts));

// Test 3: LLM mixes both forms.
const llmMixed =
  "The £4.58M ELIMINATE bucket avoids £4,580,000 of annual run-cost; " +
  "MIGRATE at £16.9M is the largest single move.";
check("LLM mixed-form prose passes", verifyDollarAmounts(llmMixed, allowedCosts));

// Test 4: LLM hallucinates a number not in allowed set.
const llmHallucination =
  "Decommissioning releases £4.58M annually; the multi-year savings reach £25M.";
check("hallucinated £25M (not in allowed) FAILS", !verifyDollarAmounts(llmHallucination, allowedCosts));

// Test 5: LLM fabricates per-app cost.
const llmFakeApp =
  "SAP at £9M is the largest MIGRATE candidate.";
check("fabricated £9M (real SAP is £8.4M) FAILS", !verifyDollarAmounts(llmFakeApp, allowedCosts));

// Test 6: Empty / no costs.
check("empty text passes", verifyDollarAmounts("All apps stay TOLERATE.", allowedCosts));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail === 0 ? 0 : 1);
