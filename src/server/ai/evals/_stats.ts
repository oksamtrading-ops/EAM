/** Tiny stats helpers shared across judge test files. Inline math
 *  is fine; consolidating here keeps each test file thin and lets us
 *  swap the variance estimator (e.g. trimmed-mean) in one place
 *  later if 3-sample noise becomes an issue. */

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance =
    xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return Math.sqrt(variance);
}
