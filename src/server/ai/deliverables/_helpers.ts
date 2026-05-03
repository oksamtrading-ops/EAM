import "server-only";
import {
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Footer,
  Header,
  PageNumber,
  ImageRun,
  type IShadingAttributesProperties,
} from "docx";
import { T, TONE, TONE_TINT, LIFECYCLE_TONE, type Tone } from "./tokens";

/** Default brand color when the workspace hasn't set one. Matches
 *  the platform's --ai token (violet). docx wants hex without `#`. */
const DEFAULT_BRAND_HEX = "7C3AED";

/** Sanitize a workspace-supplied hex into the 6-char form docx wants.
 *  Accepts "#7c3aed" or "7c3aed"; falls back to default on garbage. */
export function normalizeHex(input: string | null | undefined): string {
  if (!input) return DEFAULT_BRAND_HEX;
  const stripped = input.replace(/^#/, "").trim().toUpperCase();
  if (/^[0-9A-F]{6}$/.test(stripped)) return stripped;
  if (/^[0-9A-F]{3}$/.test(stripped)) {
    // Expand short hex to 6 chars
    return stripped
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return DEFAULT_BRAND_HEX;
}

export { formatCurrency, formatCurrencyCompact } from "@/lib/currency";

/** ISO-8601 date string formatted for a doc cover page. */
export function formatDateISO(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Inline-markdown renderer (backticks → mono, **bold**, *italic*).
 *  Lifted from the legacy buildDocx so the new template inherits the
 *  same conventions. */
export function renderInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      runs.push(new TextRun({ text: text.slice(cursor, match.index) }));
    }
    if (match[1] != null) {
      runs.push(
        new TextRun({ text: match[1], font: "Consolas", color: "6B21A8" })
      );
    } else if (match[2] != null) {
      runs.push(new TextRun({ text: match[2], bold: true }));
    } else if (match[3] != null) {
      runs.push(new TextRun({ text: match[3], italics: true }));
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    runs.push(new TextRun({ text: text.slice(cursor) }));
  }
  return runs.length > 0 ? runs : [new TextRun({ text })];
}

/** Action-title paragraph — the bolded "key takeaway" line that
 *  sits directly underneath each H1 in MBB-style decks.
 *  Italic 13pt with a 2pt brand-colored left border + padding.
 *  Idiomatic Word (no colored callout bar — that's a PowerPoint
 *  master-slide artifact in disguise).
 *
 *  Per MBB convention these MUST be complete sentences containing
 *  a number ("Eleven apps drive 38% of run-cost..."), not topic
 *  labels ("Elimination Candidates"). The caller is responsible
 *  for that — this helper just renders. */
export function actionTitle(text: string, brandHex: string): Paragraph {
  return new Paragraph({
    spacing: { before: 80, after: 240 },
    indent: { left: 200 },
    border: {
      left: {
        style: BorderStyle.SINGLE,
        size: 16, // 2pt — docx units are 1/8pt
        color: brandHex,
        space: 12,
      },
    },
    children: [
      new TextRun({
        text,
        italics: true,
        size: 26, // 13pt
        color: "1F2937",
      }),
    ],
  });
}

/** Build a brand-tinted heading paragraph. */
export function brandedHeading(
  text: string,
  level: typeof HeadingLevel[keyof typeof HeadingLevel],
  brandHex: string,
  opts: { spacingBefore?: number; spacingAfter?: number } = {}
): Paragraph {
  return new Paragraph({
    heading: level,
    spacing: {
      before: opts.spacingBefore ?? 240,
      after: opts.spacingAfter ?? 120,
    },
    children: [
      new TextRun({
        text,
        color: brandHex,
        bold: true,
      }),
    ],
  });
}

/** Cover page paragraphs. Returns a flat array of paragraphs the
 *  caller pushes onto its document children list (followed by a page
 *  break before the next section). */
export function renderCoverPage(opts: {
  documentTitle: string;
  clientName: string;
  brandHex: string;
  templateVersionLabel: string; // e.g. "EAM Rationalization Template v1.0"
  preparedBy?: string | null;
  logoBytes?: Buffer | null;
  logoMimeType?: string | null;
  /** Three-field engagement bar above the page break, 8pt grey,
   *  pipe-separated. Any field set populates the bar. */
  engagementCode?: string | null;
  contactLine?: string | null;
  confidentialityLabel?: string | null;
}): Paragraph[] {
  const out: Paragraph[] = [];

  // Top spacer
  out.push(new Paragraph({ spacing: { before: 1200, after: 0 }, children: [] }));

  // Logo (centered, ~2" tall)
  if (opts.logoBytes && opts.logoMimeType) {
    try {
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 480 },
          children: [
            new ImageRun({
              data: opts.logoBytes,
              transformation: { width: 200, height: 80 },
              type: imageRunType(opts.logoMimeType),
            } as never),
          ],
        })
      );
    } catch {
      // Bad image bytes — skip silently rather than fail the doc.
    }
  }

  // Document title (huge, brand-tinted)
  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
      children: [
        new TextRun({
          text: opts.documentTitle,
          color: opts.brandHex,
          bold: true,
          size: 56, // 28pt
          font: "Calibri",
        }),
      ],
    })
  );

  // Subtitle: client name
  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      children: [
        new TextRun({
          text: opts.clientName,
          color: "333333",
          size: 36, // 18pt
          font: "Calibri",
        }),
      ],
    })
  );

  // Generation date + template version
  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 720, after: 80 },
      children: [
        new TextRun({
          text: formatDateISO(),
          color: "666666",
          size: 22,
          italics: true,
        }),
      ],
    })
  );

  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: opts.templateVersionLabel,
          color: "999999",
          size: 18,
          italics: true,
        }),
      ],
    })
  );

  if (opts.preparedBy) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120 },
        children: [
          new TextRun({
            text: `Prepared by ${opts.preparedBy}`,
            color: "999999",
            size: 18,
            italics: true,
          }),
        ],
      })
    );
  }

  // Engagement-meta bar: confidentiality | engagement code | contact.
  const engagementParts: string[] = [];
  if (opts.confidentialityLabel) {
    engagementParts.push(opts.confidentialityLabel);
  } else {
    engagementParts.push(
      `Strictly Confidential — Prepared for ${opts.clientName}`
    );
  }
  if (opts.engagementCode) {
    engagementParts.push(`Engagement ${opts.engagementCode}`);
  }
  if (opts.contactLine) {
    engagementParts.push(opts.contactLine);
  }
  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 720, after: 0 },
      children: [
        new TextRun({
          text: engagementParts.join("    |    "),
          color: "9CA3AF",
          size: T.footer,
          italics: true,
        }),
      ],
    })
  );

  // Forces a page break so the body starts on page 2.
  out.push(
    new Paragraph({
      children: [
        new TextRun({ text: "", break: 1 }),
      ],
      pageBreakBefore: true,
    })
  );

  return out;
}

/** Consultant-grade footer. Three pipe-separated fields, 8pt grey:
 *
 *   Strictly Confidential — Prepared for {client}    |    {project}    |    Page X of Y
 *
 *  Per MBB convention. Drops the date (cover has it) and the
 *  template version (lives in Document.creator metadata for
 *  traceability). "Strictly Confidential" is the right register;
 *  "Confidential and Proprietary" is law-firm tone, avoid. */
export function makeFooter(
  clientName: string,
  projectLabel: string
): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Strictly Confidential — Prepared for ${clientName}`,
            color: "9CA3AF",
            size: 16,
            italics: true,
          }),
          new TextRun({
            text: `    |    ${projectLabel}    |    `,
            color: "9CA3AF",
            size: 16,
          }),
          new TextRun({
            children: ["Page ", PageNumber.CURRENT],
            color: "9CA3AF",
            size: 16,
          }),
          new TextRun({
            children: [" of ", PageNumber.TOTAL_PAGES],
            color: "9CA3AF",
            size: 16,
          }),
        ],
      }),
    ],
  });
}

/** Optional empty header. Kept as a placeholder for future
 *  brand-tinted top borders without requiring callers to import
 *  Header themselves. */
export function makeEmptyHeader(): Header {
  return new Header({
    children: [new Paragraph({ children: [] })],
  });
}

/** MBB-style table builder.
 *  - Header row: brand-color text, bold, with a 2pt brand bottom border.
 *  - Body rows: alternating row banding (white / FAFAFA), no vertical
 *    borders, no horizontal borders between body rows.
 *  - This is the "gridless body" look real consulting decks use:
 *    separation by tone, not by lines.
 *
 *  v2 additions (back-compat — both opts default to off):
 *  - `numericColumns`: column indexes that should right-align with
 *    tabular numerals (cost / count / % columns).
 *  - `barColumns`: column indexes that should render as a horizontal
 *    bar (cell-width brand-tinted shading proportional to value).
 *    `valueOf` parses the cell back to a 0..1 value for bar width.
 */
export function buildTable(opts: {
  headers: string[];
  rows: string[][];
  brandHex: string;
  columnWidthsPct?: number[];
  numericColumns?: number[];
  barColumns?: Array<{
    index: number;
    valueOf: (row: string[]) => number; // 0..1
  }>;
}): Table {
  const headerShading: IShadingAttributesProperties = {
    fill: "FFFFFF",
  };
  const headerBottom = {
    style: BorderStyle.SINGLE,
    size: 12, // ~1.5pt
    color: opts.brandHex,
  };
  const noBorder = {
    style: BorderStyle.NONE,
    size: 0,
    color: "FFFFFF",
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: noBorder,
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
      insideHorizontal: noBorder,
      insideVertical: noBorder,
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: opts.headers.map(
          (h, i) =>
            new TableCell({
              shading: headerShading,
              width: opts.columnWidthsPct
                ? {
                    size: opts.columnWidthsPct[i] ?? 100 / opts.headers.length,
                    type: WidthType.PERCENTAGE,
                  }
                : undefined,
              borders: {
                top: noBorder,
                bottom: headerBottom,
                left: noBorder,
                right: noBorder,
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  spacing: { before: 60, after: 60 },
                  children: [
                    new TextRun({
                      text: h,
                      bold: true,
                      size: 20,
                      color: opts.brandHex,
                    }),
                  ],
                }),
              ],
            })
        ),
      }),
      ...opts.rows.map(
        (r, rowIdx) =>
          new TableRow({
            children: r.map((cell, i) => {
              const isNumeric = opts.numericColumns?.includes(i) ?? false;
              const barSpec = opts.barColumns?.find((b) => b.index === i);
              const isBanded = rowIdx % 2 === 1;
              const baseFill = isBanded ? "FAFAFA" : "FFFFFF";

              // Bar column: render the cell as a horizontal bar by
              // shading the cell with a brand-tint at full opacity
              // and overlaying the label. We can't do partial-width
              // shading inside a single cell without nesting tables;
              // the simpler approach is to nest a 2-cell table per
              // bar cell — filled portion + empty portion. That
              // works in Word, Google Docs, and LibreOffice.
              if (barSpec) {
                const value = Math.max(
                  0,
                  Math.min(1, barSpec.valueOf(r))
                );
                const filledPct = Math.max(2, Math.round(value * 100));
                const emptyPct = 100 - filledPct;
                const barColor = tintHex(opts.brandHex, 0.6);
                const innerNoBorder = {
                  style: BorderStyle.NONE,
                  size: 0,
                  color: "FFFFFF",
                };
                const innerTable = new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  borders: {
                    top: innerNoBorder,
                    bottom: innerNoBorder,
                    left: innerNoBorder,
                    right: innerNoBorder,
                    insideHorizontal: innerNoBorder,
                    insideVertical: innerNoBorder,
                  },
                  rows: [
                    new TableRow({
                      children: [
                        new TableCell({
                          width: {
                            size: filledPct,
                            type: WidthType.PERCENTAGE,
                          },
                          shading: { fill: barColor },
                          borders: {
                            top: innerNoBorder,
                            bottom: innerNoBorder,
                            left: innerNoBorder,
                            right: innerNoBorder,
                          },
                          children: [
                            new Paragraph({
                              spacing: { before: 0, after: 0 },
                              children: [
                                new TextRun({
                                  text: cell,
                                  size: T.small,
                                  bold: true,
                                  color: "FFFFFF",
                                }),
                              ],
                            }),
                          ],
                        }),
                        new TableCell({
                          width: {
                            size: emptyPct,
                            type: WidthType.PERCENTAGE,
                          },
                          shading: { fill: baseFill },
                          borders: {
                            top: innerNoBorder,
                            bottom: innerNoBorder,
                            left: innerNoBorder,
                            right: innerNoBorder,
                          },
                          children: [
                            new Paragraph({
                              spacing: { before: 0, after: 0 },
                              children: [new TextRun({ text: "" })],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                });
                return new TableCell({
                  width: opts.columnWidthsPct
                    ? {
                        size:
                          opts.columnWidthsPct[i] ??
                          100 / opts.headers.length,
                        type: WidthType.PERCENTAGE,
                      }
                    : undefined,
                  shading: { fill: baseFill },
                  borders: {
                    top: noBorder,
                    bottom: noBorder,
                    left: noBorder,
                    right: noBorder,
                  },
                  children: [innerTable],
                });
              }

              return new TableCell({
                width: opts.columnWidthsPct
                  ? {
                      size:
                        opts.columnWidthsPct[i] ?? 100 / opts.headers.length,
                      type: WidthType.PERCENTAGE,
                    }
                  : undefined,
                shading: { fill: baseFill },
                borders: {
                  top: noBorder,
                  bottom: noBorder,
                  left: noBorder,
                  right: noBorder,
                },
                children: [
                  new Paragraph({
                    alignment: isNumeric
                      ? AlignmentType.RIGHT
                      : AlignmentType.LEFT,
                    spacing: { before: 60, after: 60 },
                    children: [
                      new TextRun({
                        text: cell,
                        size: T.small,
                        font: isNumeric ? "Consolas" : undefined,
                      }),
                    ],
                  }),
                ],
              });
            }),
          })
      ),
    ],
  });
}

/** Lighten a hex color toward white by `amount` (0..1, where 0.92
 *  means "92% white"). Used for subtle table-header tinting. */
export function tintHex(hex: string, amount: number): string {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const tint = (c: number) => Math.round(c + (255 - c) * amount);
  const toHex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return `${toHex(tint(r))}${toHex(tint(g))}${toHex(tint(b))}`;
}

function imageRunType(mime: string): "png" | "jpg" | "gif" | "bmp" {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("bmp")) return "bmp";
  return "png";
}

/** A "callout" paragraph — light-tinted background, branded left border.
 *  Used for the Assumptions block and "no data" hints. docx doesn't
 *  natively support background-colored paragraphs, so we render a
 *  one-row, one-cell table styled to look like a callout.
 *
 *  v2: optional `tone` overrides the brand color with one of the six
 *  semantic tones (info/warn/danger/success/auth/ai). When `tone` is
 *  set, `brandHex` is ignored. Default tone is brand-color
 *  (back-compat).
 */
export function buildCallout(opts: {
  title: string;
  bullets: string[];
  brandHex: string;
  tone?: Tone;
}): Table {
  const accent = opts.tone ? TONE[opts.tone] : opts.brandHex;
  const fill = opts.tone ? TONE_TINT(opts.tone) : tintHex(opts.brandHex, 0.96);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: {
                style: BorderStyle.SINGLE,
                size: 16,
                color: accent,
              },
            },
            children: [
              new Paragraph({
                spacing: { after: 80 },
                children: [
                  new TextRun({
                    text: opts.title,
                    bold: true,
                    size: T.small,
                    color: accent,
                  }),
                ],
              }),
              ...opts.bullets.map(
                (b) =>
                  new Paragraph({
                    bullet: { level: 0 },
                    spacing: { after: 40 },
                    children: [new TextRun({ text: b, size: T.small })],
                  })
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

// ─── Contrast guard ──────────────────────────────────────────

/** Relative luminance per WCAG 2.x. Input is 6-char uppercase hex
 *  without `#`. */
function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrastRatio(fg: string, bg: string): number {
  const Lfg = relativeLuminance(fg);
  const Lbg = relativeLuminance(bg);
  const [hi, lo] = Lfg > Lbg ? [Lfg, Lbg] : [Lbg, Lfg];
  return (hi + 0.05) / (lo + 0.05);
}

/** Brand-color luminance guard. Workspaces can set arbitrary
 *  `brandColor`; a workspace choosing low-luminance colors (e.g.
 *  "#FFD700" gold or "#FFFFFF" white) makes every H1 unreadable on
 *  white. This darkens the candidate color in HSL space until the
 *  contrast ratio against `bg` clears `minRatio` (default 4.5 = WCAG
 *  AA body text). Brand color is kept as-is for fills — call this
 *  ONLY for text uses. */
export function clampForContrast(opts: {
  hex: string;
  bg?: string;
  minRatio?: number;
}): string {
  const target = opts.minRatio ?? 4.5;
  const bg = (opts.bg ?? "FFFFFF").replace(/^#/, "").toUpperCase();
  let hex = opts.hex.replace(/^#/, "").toUpperCase();
  if (contrastRatio(hex, bg) >= target) return hex;

  // Convert to HSL, darken by stepping lightness down until contrast clears.
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l0 = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l0 > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  const hslToHex = (hh: number, ss: number, ll: number): string => {
    if (ss === 0) {
      const v = Math.round(ll * 255);
      const c = v.toString(16).padStart(2, "0").toUpperCase();
      return c + c + c;
    }
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
    const p = 2 * ll - q;
    const hue2rgb = (pp: number, qq: number, t: number) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return pp + (qq - pp) * 6 * tt;
      if (tt < 1 / 2) return qq;
      if (tt < 2 / 3) return pp + (qq - pp) * (2 / 3 - tt) * 6;
      return pp;
    };
    const rr = hue2rgb(p, q, hh + 1 / 3);
    const gg = hue2rgb(p, q, hh);
    const bb = hue2rgb(p, q, hh - 1 / 3);
    const toC = (v: number) =>
      Math.round(v * 255).toString(16).padStart(2, "0").toUpperCase();
    return toC(rr) + toC(gg) + toC(bb);
  };

  for (let l = l0; l >= 0; l -= 0.04) {
    const candidate = hslToHex(h, s, l);
    if (contrastRatio(candidate, bg) >= target) return candidate;
  }
  return "111111"; // fallback: near-black always passes
}

// ─── KPI tile primitives ─────────────────────────────────────

/** A single hero-metric tile — large brand value over a small
 *  grey label. Used inside `buildKpiRow`. Brand color text uses
 *  `clampForContrast` so it stays readable against arbitrary
 *  workspace brand colors. */
export function buildKpiTile(opts: {
  value: string;
  label: string;
  brandHex: string;
}): TableCell {
  const safeBrand = clampForContrast({ hex: opts.brandHex });
  const innerNoBorder = {
    style: BorderStyle.NONE,
    size: 0,
    color: "FFFFFF",
  };
  return new TableCell({
    shading: { fill: "FFFFFF" },
    borders: {
      top: innerNoBorder,
      bottom: innerNoBorder,
      left: innerNoBorder,
      right: innerNoBorder,
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 120, after: 40 },
        children: [
          new TextRun({
            text: opts.value,
            bold: true,
            size: T.kpiHero,
            color: safeBrand,
            font: "Calibri",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 120 },
        children: [
          new TextRun({
            text: opts.label.toUpperCase(),
            size: T.kpiLabel,
            color: "6B7280",
            characterSpacing: 12,
          }),
        ],
      }),
    ],
  });
}

/** A 2×3 borderless grid of KPI tiles. Six tiles is the sweet spot
 *  — fits one page-width at A4/Letter, gives the partner-skim test
 *  six glance-able numbers. Pass exactly 6 tiles for best layout. */
export function buildKpiRow(opts: {
  tiles: Array<{ value: string; label: string }>;
  brandHex: string;
}): Table {
  const innerNoBorder = {
    style: BorderStyle.NONE,
    size: 0,
    color: "FFFFFF",
  };
  const tiles = opts.tiles.slice(0, 6);
  while (tiles.length < 6) tiles.push({ value: "—", label: "" });

  const makeRow = (group: typeof tiles) =>
    new TableRow({
      children: group.map((t) =>
        buildKpiTile({
          value: t.value,
          label: t.label,
          brandHex: opts.brandHex,
        })
      ),
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: innerNoBorder,
      bottom: innerNoBorder,
      left: innerNoBorder,
      right: innerNoBorder,
      insideHorizontal: innerNoBorder,
      insideVertical: innerNoBorder,
    },
    rows: [makeRow(tiles.slice(0, 3)), makeRow(tiles.slice(3, 6))],
  });
}

// ─── Status pill ─────────────────────────────────────────────

/** Inline tone-aware pill rendering. Returns a TableCell suitable
 *  for use inside `buildTable`'s row arrays — the caller inserts the
 *  cell shape as a "rendered" string and uses a custom cell builder.
 *  Since `buildTable` works on string[][] today, the simpler
 *  integration is: caller renders the pill text upper-cased and uses
 *  this helper directly in a hand-built table when pills are needed.
 *
 *  For Portfolio Snapshot v2 we use this as a small inline TextRun
 *  array consumable inside a manually-built lifecycle row. */
export function statusPillRuns(opts: {
  text: string;
  tone: Tone;
}): TextRun[] {
  return [
    new TextRun({
      text: ` ${opts.text} `,
      bold: true,
      size: T.pill,
      color: TONE[opts.tone],
      // docx doesn't support background-color on inline runs, so the
      // pill effect is approximated with bold + colored small-caps.
      // For a true background-pill, use a single-cell mini-table.
      characterSpacing: 16,
    }),
  ];
}

/** Mini single-cell table that renders as a tone-tinted pill. Use
 *  inside hand-built lifecycle/disposition cells when a colored
 *  background is needed. */
export function buildStatusPillCell(opts: {
  text: string;
  tone: Tone;
}): TableCell {
  const innerNoBorder = {
    style: BorderStyle.NONE,
    size: 0,
    color: "FFFFFF",
  };
  return new TableCell({
    shading: { fill: TONE_TINT(opts.tone) },
    borders: {
      top: innerNoBorder,
      bottom: innerNoBorder,
      left: innerNoBorder,
      right: innerNoBorder,
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: opts.text.toUpperCase(),
            bold: true,
            size: T.pill,
            color: TONE[opts.tone],
            characterSpacing: 12,
          }),
        ],
      }),
    ],
  });
}

/** Map a lifecycle string to a Tone using the centralized mapping
 *  in tokens.ts. Falls back to "info" for unknown lifecycles. */
export function lifecycleToTone(lifecycle: string): Tone {
  return LIFECYCLE_TONE[lifecycle] ?? "info";
}
