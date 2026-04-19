import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import {
  extractKnowledgeFromExistingDocument,
  extractKnowledgeFromNewUpload,
} from "@/server/ai/services/knowledgeExtraction";
import { classifyAnthropicError } from "@/server/ai/client";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ACCEPTED_MIME = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  XLSX_MIME,
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

  const contentType = req.headers.get("content-type") ?? "";

  // Two modes:
  // (a) JSON body { workspaceId, documentId } — re-extract from existing IntakeDocument.
  // (b) multipart FormData { workspaceId, file } — fresh upload.
  if (contentType.includes("application/json")) {
    const { workspaceId, documentId } = (await req.json()) as {
      workspaceId?: string;
      documentId?: string;
    };
    if (!workspaceId || !documentId) {
      return NextResponse.json(
        { error: "workspaceId and documentId required" },
        { status: 400 }
      );
    }
    const ws = await db.workspace.findFirst({
      where: { id: workspaceId, userId: user.id },
      select: { id: true },
    });
    if (!ws) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
      const result = await extractKnowledgeFromExistingDocument({
        workspaceId,
        documentId,
      });
      return NextResponse.json({
        mode: "existing",
        documentId,
        draftsCreated: result.draftsCreated,
      });
    } catch (err) {
      const info = classifyAnthropicError(err);
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : info.friendly,
          code: info.code,
        },
        { status: 500 }
      );
    }
  }

  // Multipart upload path
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const workspaceId = formData.get("workspaceId") as string | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!workspaceId)
    return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });

  const ws = await db.workspace.findFirst({
    where: { id: workspaceId, userId: user.id },
    select: { id: true },
  });
  if (!ws) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const mimeType = normalizeMime(file.type, file.name);
  if (!ACCEPTED_MIME.has(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mimeType}. Accepted: PDF, XLSX, TXT, MD` },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB)` },
      { status: 400 }
    );
  }

  const skipExtraction =
    (formData.get("skipExtraction") as string | null) === "true";

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const result = await extractKnowledgeFromNewUpload({
      workspaceId,
      userId: user.id,
      bytes,
      filename: file.name,
      mimeType,
      skipExtraction,
    });
    return NextResponse.json({
      mode: "new",
      documentId: result.documentId,
      draftsCreated: result.draftsCreated,
      extracted: result.extracted,
    });
  } catch (err) {
    const info = classifyAnthropicError(err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : info.friendly,
        code: info.code,
      },
      { status: 500 }
    );
  }
}

function normalizeMime(mime: string | undefined, filename: string): string {
  if (mime === "application/pdf") return "application/pdf";
  if (mime === "text/plain" || mime === "text/markdown") return mime;
  if (mime === XLSX_MIME || mime === "application/vnd.ms-excel") return XLSX_MIME;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return XLSX_MIME;
  return mime ?? "application/octet-stream";
}
