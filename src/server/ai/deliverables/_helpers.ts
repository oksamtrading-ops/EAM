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

/** Format a currency amount with Intl.NumberFormat. Handles unknown
 *  currency codes by falling back to USD without throwing. Returns a
 *  display string like "$1,250,000" or "€1,2 Mio." (locale-dependent). */
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
 */
export function buildTable(opts: {
  headers: string[];
  rows: string[][];
  brandHex: string;
  columnWidthsPct?: number[];
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
            children: r.map(
              (cell, i) =>
                new TableCell({
                  width: opts.columnWidthsPct
                    ? {
                        size:
                          opts.columnWidthsPct[i] ?? 100 / opts.headers.length,
                        type: WidthType.PERCENTAGE,
                      }
                    : undefined,
                  shading: {
                    fill: rowIdx % 2 === 1 ? "FAFAFA" : "FFFFFF",
                  },
                  borders: {
                    top: noBorder,
                    bottom: noBorder,
                    left: noBorder,
                    right: noBorder,
                  },
                  children: [
                    new Paragraph({
                      spacing: { before: 60, after: 60 },
                      children: [new TextRun({ text: cell, size: 20 })],
                    }),
                  ],
                })
            ),
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

/** A "callout" paragraph — light-tinted background, brand left border.
 *  Used for the Assumptions block and "no data" hints. docx doesn't
 *  natively support background-colored paragraphs, so we render a
 *  one-row, one-cell table styled to look like a callout. */
export function buildCallout(opts: {
  title: string;
  bullets: string[];
  brandHex: string;
}): Table {
  const fill = tintHex(opts.brandHex, 0.96);
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
                color: opts.brandHex,
              },
            },
            children: [
              new Paragraph({
                spacing: { after: 80 },
                children: [
                  new TextRun({
                    text: opts.title,
                    bold: true,
                    size: 20,
                    color: opts.brandHex,
                  }),
                ],
              }),
              ...opts.bullets.map(
                (b) =>
                  new Paragraph({
                    bullet: { level: 0 },
                    spacing: { after: 40 },
                    children: [new TextRun({ text: b, size: 20 })],
                  })
              ),
            ],
          }),
        ],
      }),
    ],
  });
}
