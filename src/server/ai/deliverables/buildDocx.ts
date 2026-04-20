import "server-only";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} from "docx";
import { anthropic } from "@/server/ai/client";
import { MODEL_SONNET } from "@/server/ai/models";
import {
  DELIVERABLE_SUMMARIZER_PROMPT,
  DELIVERABLE_SUMMARIZER_VERSION,
} from "@/server/ai/prompts/deliverableSummarizer.v1";

export type DeliverableInput = {
  title: string;
  workspaceLabel: string;
  runs: Array<{
    id: string;
    kind: string;
    label: string; // human-friendly heading — conversation title when available
    finalText: string;
    startedAt: Date;
  }>;
  facts: Array<{
    id: string;
    subject: string;
    statement: string;
    kind: string;
    confidence: number;
  }>;
  initiatives: Array<{
    id: string;
    name: string;
    description: string | null;
    category: string;
    horizon: string;
    priority: string;
  }>;
};

export type DeliverableResult = {
  buffer: Buffer;
  summary: {
    executiveSummary: string;
    recommendedNextSteps: string[];
  };
};

export async function buildDeliverableDocx(
  input: DeliverableInput
): Promise<DeliverableResult> {
  const summary = await generateSummary(input);

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: input.title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 60 },
    }),
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: `${input.workspaceLabel} · Enterprise Architecture Deliverable`,
          italics: true,
          color: "666666",
        }),
        new TextRun({ text: "  ·  ", italics: true, color: "999999" }),
        new TextRun({
          text: `Generated ${new Date().toLocaleString()}`,
          italics: true,
          color: "666666",
        }),
      ],
    })
  );

  // Executive Summary
  children.push(
    new Paragraph({
      text: "Executive Summary",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 },
    })
  );
  for (const para of summary.executiveSummary.split(/\n{2,}/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: renderInline(trimmed),
      })
    );
  }

  // Recommended Next Steps
  if (summary.recommendedNextSteps.length > 0) {
    children.push(
      new Paragraph({
        text: "Recommended Next Steps",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
      })
    );
    for (const step of summary.recommendedNextSteps) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 80 },
          children: renderInline(step),
        })
      );
    }
  }

  // Findings — one subsection per run
  if (input.runs.length > 0) {
    children.push(
      new Paragraph({
        text: "Findings",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 120 },
      })
    );
    for (const run of input.runs) {
      children.push(
        new Paragraph({
          text: `${run.label} · ${run.startedAt.toLocaleDateString()}`,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 180, after: 80 },
        })
      );
      for (const block of (run.finalText ?? "").split(/\n{2,}/)) {
        const trimmed = block.trim();
        if (!trimmed) continue;
        const lines = trimmed.split("\n");
        const isBullet = lines.every((l) => /^\s*[-*•]\s+/.test(l));
        if (isBullet) {
          for (const line of lines) {
            children.push(
              new Paragraph({
                bullet: { level: 0 },
                spacing: { after: 60 },
                children: renderInline(
                  line.replace(/^\s*[-*•]\s+/, "")
                ),
              })
            );
          }
        } else {
          children.push(
            new Paragraph({
              spacing: { after: 120 },
              children: renderInline(trimmed),
            })
          );
        }
      }
    }
  }

  // Curated Knowledge table
  if (input.facts.length > 0) {
    children.push(
      new Paragraph({
        text: "Curated Knowledge",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 120 },
      })
    );
    children.push(
      buildTable(
        ["Subject", "Statement", "Kind", "Confidence"],
        input.facts.map((f) => [
          f.subject,
          f.statement,
          f.kind,
          `${Math.round(f.confidence * 100)}%`,
        ])
      ) as unknown as Paragraph
    );
  }

  // Recommended Initiatives table
  if (input.initiatives.length > 0) {
    children.push(
      new Paragraph({
        text: "Recommended Initiatives",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 120 },
      })
    );
    children.push(
      buildTable(
        ["Name", "Category", "Horizon", "Priority", "Rationale"],
        input.initiatives.map((i) => [
          i.name,
          i.category,
          i.horizon,
          i.priority,
          i.description ?? "",
        ])
      ) as unknown as Paragraph
    );
  }

  // Appendix: Trace references
  if (input.runs.length > 0) {
    children.push(
      new Paragraph({
        text: "Appendix — Trace References",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 120 },
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: "Every finding above is backed by a recorded agent run. IDs for audit:",
            italics: true,
            color: "666666",
            size: 20,
          }),
        ],
      })
    );
    for (const run of input.runs) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: `${run.label} (${run.kind}) — `,
              size: 20,
            }),
            new TextRun({
              text: run.id,
              font: "Consolas",
              color: "555555",
              size: 20,
            }),
          ],
        })
      );
    }
  }

  const doc = new Document({
    creator: input.workspaceLabel,
    title: input.title,
    description: "EAM Client Deliverable",
    sections: [{ properties: {}, children }],
    styles: {
      default: { document: { run: { size: 22, font: "Calibri" } } },
    },
  });

  const buffer = await Packer.toBuffer(doc);
  return { buffer: Buffer.from(buffer), summary };
}

async function generateSummary(
  input: DeliverableInput
): Promise<{ executiveSummary: string; recommendedNextSteps: string[] }> {
  const items: Array<{ kind: string; content: string }> = [];
  for (const r of input.runs) {
    items.push({
      kind: "run",
      content: `[${r.label}] ${r.finalText}`.slice(0, 4000),
    });
  }
  for (const f of input.facts) {
    items.push({
      kind: "fact",
      content: `${f.subject}: ${f.statement}`,
    });
  }
  for (const i of input.initiatives) {
    items.push({
      kind: "initiative",
      content: `${i.name} (${i.category}, ${i.horizon}, ${i.priority}): ${i.description ?? ""}`,
    });
  }

  const response = await anthropic.messages.create({
    model: MODEL_SONNET,
    max_tokens: 3000,
    system: DELIVERABLE_SUMMARIZER_PROMPT,
    messages: [
      {
        role: "user",
        content: `Workspace: ${input.workspaceLabel}\nTitle: ${input.title}\n\nItems (${items.length}):\n${JSON.stringify(items, null, 2)}\n\nReturn JSON only.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw =
    textBlock && "text" in textBlock && typeof textBlock.text === "string"
      ? textBlock.text
      : "";
  const json = extractJson(raw);
  try {
    const parsed = JSON.parse(json) as {
      executiveSummary?: string;
      recommendedNextSteps?: unknown;
    };
    return {
      executiveSummary: parsed.executiveSummary ?? "",
      recommendedNextSteps: Array.isArray(parsed.recommendedNextSteps)
        ? parsed.recommendedNextSteps.map(String).slice(0, 20)
        : [],
    };
  } catch {
    return {
      executiveSummary: raw.slice(0, 4000),
      recommendedNextSteps: [],
    };
  }
}

function extractJson(raw: string): string {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) return fence[1].trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) return raw.slice(first, last + 1);
  return raw.trim();
}

function renderInline(text: string): TextRun[] {
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
        new TextRun({
          text: match[1],
          font: "Consolas",
          color: "6B21A8",
        })
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

function buildTable(headers: string[], rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map(
          (h) =>
            new TableCell({
              shading: { fill: "F3F4F6" },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [
                    new TextRun({ text: h, bold: true, size: 20 }),
                  ],
                }),
              ],
            })
        ),
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map(
              (cell) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: cell, size: 20 })],
                    }),
                  ],
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                    left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                    right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                  },
                })
            ),
          })
      ),
    ],
  });
}

export { DELIVERABLE_SUMMARIZER_VERSION };
