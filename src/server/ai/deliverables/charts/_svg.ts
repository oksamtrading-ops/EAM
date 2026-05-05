import "server-only";
import { TONE, type Tone } from "../tokens";

/** XML-escape a string for safe embedding in SVG text content. */
export function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Lighten a hex color toward white by `amount` (0..1). Mirror of
 *  the docx `tintHex` helper. */
export function tint(hex: string, amount: number): string {
  const h = hex.replace(/^#/, "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const t = (c: number) => Math.round(c + (255 - c) * amount);
  const toHex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(t(r))}${toHex(t(g))}${toHex(t(b))}`;
}

/** Compose a brand color reference for SVG (handles `#` prefix). */
export function brandRef(hex: string): string {
  return hex.startsWith("#") ? hex : `#${hex}`;
}

/** Tone color references for chart fills. */
export function toneHex(tone: Tone): string {
  return brandRef(TONE[tone]);
}

export const NEUTRAL_GREY = "#6B7280";
export const NEUTRAL_LIGHT = "#E5E7EB";
export const NEUTRAL_FAINT = "#F3F4F6";

/** Standard chart frame: width × height with consistent padding,
 *  white background, brand-color title bar across the top. */
export function chartFrame(opts: {
  width: number;
  height: number;
  title: string;
  brandHex: string;
  body: string; // SVG body content (already positioned within the inner area)
}): string {
  const { width, height, title, body } = opts;
  const brand = brandRef(opts.brandHex);
  const titleHeight = 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="Inter">
    <rect x="0" y="0" width="${width}" height="${height}" fill="white"/>
    <rect x="0" y="0" width="${width}" height="3" fill="${brand}"/>
    <text x="40" y="32" font-size="20" font-weight="700" fill="${brand}">${esc(title)}</text>
    <g transform="translate(0, ${titleHeight})">${body}</g>
  </svg>`;
}

/** Format a number compactly for axis labels (£8.4M, 75%). */
export function fmtMoneyShort(n: number, currency: string): string {
  const symbol =
    currency === "GBP" ? "£" :
    currency === "EUR" ? "€" :
    currency === "JPY" ? "¥" :
    "$";
  if (Math.abs(n) >= 1_000_000_000) return `${symbol}${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `${symbol}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${symbol}${Math.round(n / 1_000)}k`;
  return `${symbol}${n.toFixed(0)}`;
}

/** Linear scale: domain [d0,d1] → range [r0,r1]. */
export function scale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  return (v: number) => (span === 0 ? r0 : r0 + ((v - d0) / span) * (r1 - r0));
}
