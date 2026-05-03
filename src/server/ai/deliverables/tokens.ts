import "server-only";

// Inline tint math to avoid a circular import with _helpers.ts.
// `_helpers.ts` re-exports its own `tintHex`; this is the same logic
// kept private to the tokens module.
function tintHexLocal(hex: string, amount: number): string {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const tint = (c: number) => Math.round(c + (255 - c) * amount);
  const toHex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return `${toHex(tint(r))}${toHex(tint(g))}${toHex(tint(b))}`;
}

// ─── Typography ──────────────────────────────────────────────
// All sizes in half-points (docx convention). 22 = 11pt body.
export const T = {
  h1: 56, // 28pt
  h2: 32, // 16pt
  h3: 26, // 13pt
  actionTitle: 26, // 13pt italic with brand left border
  body: 22, // 11pt
  small: 20, // 10pt — table cells
  kpiHero: 48, // 24pt brand bold — hero metric
  kpiLabel: 18, // 9pt grey
  footer: 16, // 8pt grey
  pill: 16, // 8pt small-caps tag
} as const;

// ─── Spacing (twentieths-of-a-point, "twips") ────────────────
// Mirrors AGENTS.md gap scale conceptually. 80 twips ≈ 0.25rem.
export const S = {
  gap2: 160,
  gap3: 240,
  gap4: 320,
  sectionBefore: 480,
  afterAction: 240,
  paragraph: 160,
} as const;

// ─── Six-tone palette (mirrors AGENTS.md badge tones) ────────
export const TONE = {
  success: "059669",
  warn: "D97706",
  danger: "DC2626",
  info: "2563EB",
  auth: "7C3AED",
  ai: "7C3AED",
} as const;
export type Tone = keyof typeof TONE;

/** Light fill for callouts and pills — very subtle tint of the
 *  tone color. 0.92 = "92% white" so text reads on the fill. */
export const TONE_TINT = (tone: Tone): string =>
  tintHexLocal(TONE[tone], 0.92);

/** Lifecycle → tone mapping for status pills. Deterministic. */
export const LIFECYCLE_TONE: Record<string, Tone> = {
  ACTIVE: "success",
  PHASING_OUT: "warn",
  RETIRED: "danger",
  PLANNED: "info",
  SUNSET: "danger",
};
