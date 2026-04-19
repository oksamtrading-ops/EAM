import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  AlignmentType,
} from "docx";

export const runtime = "nodejs";

type ToolCallSummary = {
  id?: string;
  name: string;
  input?: unknown;
  ok?: boolean;
  output?: unknown;
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    conversationId?: string;
  };
  const { conversationId } = body;
  if (!conversationId) {
    return new Response("Missing conversationId", { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  });
  if (!user) return new Response("User not found", { status: 401 });

  const convo = await db.agentConversation.findFirst({
    where: { id: conversationId, userId: user.id },
    include: {
      workspace: { select: { name: true, clientName: true } },
      messages: { orderBy: { ordinal: "asc" } },
    },
  });
  if (!convo) return new Response("Not found", { status: 404 });

  const workspaceLabel =
    convo.workspace.clientName && convo.workspace.clientName.trim().length
      ? convo.workspace.clientName
      : convo.workspace.name;

  const exportedAt = new Date().toLocaleString();

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: convo.title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 80 },
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `${workspaceLabel} · Agent Console transcript`,
          italics: true,
          color: "666666",
        }),
        new TextRun({ text: "  ·  ", italics: true, color: "999999" }),
        new TextRun({
          text: `Exported ${exportedAt}`,
          italics: true,
          color: "666666",
        }),
      ],
    })
  );

  // Turns
  for (const m of convo.messages) {
    const isUser = m.role === "user";
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 60 },
        children: [
          new TextRun({
            text: isUser ? "Question" : "Agent",
            bold: true,
            size: 22,
            color: isUser ? "333333" : "7C3AED", // AI accent for agent
          }),
        ],
      })
    );

    // Tool-call summary (agent turns only)
    if (!isUser && Array.isArray(m.toolCalls)) {
      const calls = m.toolCalls as ToolCallSummary[];
      for (const c of calls) {
        const glyph =
          c.ok === true ? "✓" : c.ok === false ? "✗" : "…";
        const color = c.ok === false ? "C53030" : "7C3AED";
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: `${glyph} `,
                color,
                bold: true,
              }),
              new TextRun({
                text: c.name,
                font: "Consolas",
                color: "555555",
              }),
            ],
          })
        );
      }
    }

    // Message body — split on blank lines so paragraphs render; bullets render as bullets.
    const blocks = (m.content ?? "").split(/\n{2,}/);
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      const lines = trimmed.split("\n");
      const isBulletBlock = lines.every((l) => /^\s*[-*•]\s+/.test(l));
      if (isBulletBlock) {
        for (const line of lines) {
          const text = line.replace(/^\s*[-*•]\s+/, "");
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 40 },
              children: renderInline(text),
            })
          );
        }
      } else {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            children: renderInline(trimmed),
          })
        );
      }
    }
  }

  const doc = new Document({
    creator: workspaceLabel,
    title: convo.title,
    description: "EAM Agent Console transcript",
    sections: [
      {
        properties: {},
        children,
      },
    ],
    styles: {
      default: {
        document: {
          run: { size: 22, font: "Calibri" }, // 11pt
        },
      },
    },
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `${slugify(convo.title)}.docx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Minimal inline runner — handles **bold**, *italic*, `code`.
 * Mirrors the client-side renderMarkdown scope.
 */
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

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "agent-thread"
  );
}
