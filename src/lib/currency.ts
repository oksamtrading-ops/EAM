/** Format a money amount with the symbol/grouping for the given ISO currency.
 *  Tolerates unknown currency codes by falling back to USD. */
export function formatCurrency(
  amount: number,
  currency = "USD",
  locale = "en-US"
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  }
}

/** Compact currency for tight UI surfaces: "£6.2M", "$1.5B", "€48K".
 *  Uses native compact notation; falls back to the full formatter for
 *  amounts under 1000 since "£900" reads better than "£900". */
export function formatCurrencyCompact(
  amount: number,
  currency = "USD",
  locale = "en-US"
): string {
  if (Math.abs(amount) < 1000) return formatCurrency(amount, currency, locale);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  }
}
