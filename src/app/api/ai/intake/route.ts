import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { extractFromDocument } from "@/server/ai/services/intakeExtraction";
import { classifyAnthropicError } from "@/server/ai/client";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const ACCEPTED_MIME = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const workspaceId = formData.get("workspaceId") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!workspaceId)
    return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, userId: user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const mimeType = normalizeMime(file.type, file.name);
  if (!ACCEPTED_MIME.has(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mimeType}. Accepted: PDF, TXT, MD` },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB)` },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  const document = await db.intakeDocument.create({
    data: {
      workspaceId,
      filename: file.name,
      mimeType,
      sizeBytes: file.size,
      storageKey: `inline:${file.name}`,
      status: "PENDING",
      uploadedBy: user.id,
    },
    select: { id: true },
  });

  try {
    const result = await extractFromDocument({
      documentId: document.id,
      workspaceId,
      filename: file.name,
      mimeType,
      bytes,
    });

    return NextResponse.json({
      documentId: document.id,
      chunksCreated: result.chunksCreated,
      draftsCreated: result.draftsCreated,
    });
  } catch (err) {
    const info = classifyAnthropicError(err);
    return NextResponse.json(
      { error: info.friendly, code: info.code, documentId: document.id },
      { status: 500 }
    );
  }
}

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function normalizeMime(mime: string | undefined, filename: string): string {
  if (mime === "application/pdf") return "application/pdf";
  if (mime === "text/plain" || mime === "text/markdown") return mime;
  if (mime === XLSX_MIME || mime === "application/vnd.ms-excel") return XLSX_MIME;
  // Fallback by extension (browsers don't always send the right MIME)
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return XLSX_MIME;
  return mime ?? "application/octet-stream";
}
