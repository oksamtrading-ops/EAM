import { NextResponse } from "next/server";
import { db } from "@/server/db";

export const runtime = "nodejs";

/**
 * Public endpoint. No Clerk auth. Returns a conversation transcript by
 * slug, respecting revocation + expiry + tool-call redaction. Workspace
 * name is surfaced (not the workspace id) so share pages render with
 * client branding without leaking internal identifiers.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const share = await db.agentConversationShare.findUnique({
    where: { slug },
    include: {
      conversation: {
        include: {
          workspace: {
          select: {
            name: true,
            clientName: true,
            logoUrl: true,
            brandColor: true,
          },
        },
          messages: { orderBy: { ordinal: "asc" } },
        },
      },
    },
  });

  if (!share || share.revoked) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "Share has expired" },
      { status: 410 }
    );
  }

  const workspaceLabel =
    share.conversation.workspace.clientName?.trim() ||
    share.conversation.workspace.name;

  return NextResponse.json({
    title: share.title ?? share.conversation.title,
    workspace: workspaceLabel,
    brandLogoUrl: share.conversation.workspace.logoUrl,
    brandColor: share.conversation.workspace.brandColor,
    createdAt: share.createdAt.toISOString(),
    redactToolCalls: share.redactToolCalls,
    messages: share.conversation.messages.map((m) => ({
      id: m.id,
      ordinal: m.ordinal,
      role: m.role,
      content: m.content,
      toolCalls: share.redactToolCalls ? null : m.toolCalls,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
