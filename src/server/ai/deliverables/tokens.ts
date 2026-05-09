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
  sectionNumber: 240, // 120pt — section divider page
  sectionDividerTitle: 72, // 36pt — section divider title
  tocEntry: 24, // 12pt — TOC entries
  tocPageNumber: 22, // 11pt — TOC page number column
  disclaimer: 22, // 11pt italic grey — inside-cover disclaimer
  heatmapValue: 22, // 11pt — count overlay in heatmap cells
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

/** Maturity-level → tone mapping for status pills. Tones progress
 *  from danger (lowest) → success (mid) → auth (highest) so the
 *  visual heat reads as "lift required" left-to-right. The OPTIMIZING
 *  tone uses auth (violet) to signal "leading-edge / rare," distinct
 *  from the success tone of MANAGED so readers can see the gap
 *  between baseline competence (MANAGED) and industry-leading
 *  (OPTIMIZING). NOT_ASSESSED gets info (neutral) — explicitly not
 *  danger, since unknown ≠ failing. */
export const MATURITY_TONE: Record<string, Tone> = {
  INITIAL: "danger",
  DEVELOPING: "warn",
  DEFINED: "info",
  MANAGED: "success",
  OPTIMIZING: "auth",
  NOT_ASSESSED: "info",
};

/** Strategic-importance → tone mapping. Separate scale from
 *  maturity. CRITICAL and HIGH read as urgency-tier on unfilled
 *  gaps. LOW reads as "success" because LOW importance + high
 *  maturity = over-served signal worth surfacing in the Reassess
 *  Strategy band. */
export const IMPORTANCE_TONE: Record<string, Tone> = {
  CRITICAL: "danger",
  HIGH: "warn",
  MEDIUM: "info",
  LOW: "success",
  NOT_ASSESSED: "info",
};

/** Wave urgency for the Architecture Roadmap deliverable. NOW reads
 *  as urgency (danger), NEXT as elevated attention (warn), LATER as
 *  baseline (info). Mirrors the maturity-band action-class
 *  semantics: stronger visual heat for the work that has to start
 *  this fiscal year. */
export const WAVE_TONE: Record<string, Tone> = {
  NOW: "danger",
  NEXT: "warn",
  LATER: "info",
};

/** Initiative RAG (red-amber-green) status. Maps directly from
 *  Initiative.ragStatus. */
export const INITIATIVE_RAG_TONE: Record<string, Tone> = {
  GREEN: "success",
  AMBER: "warn",
  RED: "danger",
};

/** Initiative category colour-coding for the Gantt swim-lane.
 *  Mirrors the InitiativeCategory enum on the schema. */
export const INITIATIVE_CATEGORY_TONE: Record<string, Tone> = {
  MODERNISATION: "info",
  CONSOLIDATION: "success",
  DIGITALISATION: "auth",
  COMPLIANCE: "warn",
  OPTIMISATION: "success",
  INNOVATION: "auth",
  DECOMMISSION: "danger",
};
