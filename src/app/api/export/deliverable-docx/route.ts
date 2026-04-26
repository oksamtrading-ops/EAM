import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { buildDeliverableDocx } from "@/server/ai/deliverables/buildDocx";
import { buildRationalizationDocx } from "@/server/ai/deliverables/buildRationalizationDocx";
import { buildPortfolioSnapshotReport } from "@/server/ai/deliverables/buildPortfolioSnapshotReport";
import { computeRationalizationMetrics } from "@/server/ai/deliverables/rationalizationMetrics";
import { classifyAnthropicError } from "@/server/ai/client";

// Coverage threshold for the rationalization fork: at <60% the
// portfolio is too sparsely classified for a credible disposition
// plan, so we ship a smaller honest snapshot instead.
const COVERAGE_THRESHOLD = 0.6;

export const runtime = "nodejs";
export const maxDuration = 300;

type DeliverableType = "generic" | "rationalization";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    workspaceId?: string;
    type?: DeliverableType;
    title?: string;
    runIds?: string[];
    knowledgeIds?: string[];
    initiativeIds?: string[];
    clientNameOverride?: string;
  };
  const { workspaceId } = body;
  const type: DeliverableType = body.type === "rationalization"
    ? "rationalization"
    : "generic";

  if (!workspaceId) {
    return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, name: true },
  });
  if (!user) return new Response("User not found", { status: 401 });

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, userId: user.id },
    select: {
      id: true,
      name: true,
      clientName: true,
      brandColor: true,
      logoUrl: true,
    },
  });
  if (!workspace) return new Response("Forbidden", { status: 403 });

  // ─── Rationalization template ─────────────────────────────
  if (type === "rationalization") {
    const clientName =
      body.clientNameOverride?.trim() ||
      workspace.clientName?.trim() ||
      workspace.name;

    try {
      const metrics = await computeRationalizationMetrics(db, workspace.id);

      // Coverage fork: low coverage → Portfolio Snapshot Report;
      // sufficient coverage → full Application Rationalization Plan.
      // The platform refuses to ship a half-baked plan that papers
      // over an unclassified portfolio.
      const sufficientCoverage =
        metrics.coverageRatio >= COVERAGE_THRESHOLD;

      const today = new Date().toISOString().slice(0, 10);

      if (sufficientCoverage) {
        const result = await buildRationalizationDocx({
          clientName,
          brandHex: workspace.brandColor,
          logoBytes: null,
          logoMimeType: null,
          preparedBy: user.name,
          metrics,
        });
        const filename = `${slugify(clientName)}-rationalization-${today}.docx`;
        return new Response(new Uint8Array(result.buffer), {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
            "X-Deliverable-Template": `rationalization@${result.templateVersion}`,
            "X-Llm-Source": result.llmSource,
            "X-Coverage-Pct": String(Math.round(metrics.coverageRatio * 100)),
          },
        });
      } else {
        const result = await buildPortfolioSnapshotReport({
          clientName,
          brandHex: workspace.brandColor,
          preparedBy: user.name,
          metrics,
        });
        const filename = `${slugify(clientName)}-portfolio-snapshot-${today}.docx`;
        return new Response(new Uint8Array(result.buffer), {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
            "X-Deliverable-Template": `portfolio-snapshot@${result.templateVersion}`,
            "X-Llm-Source": result.llmSource,
            "X-Coverage-Pct": String(Math.round(metrics.coverageRatio * 100)),
          },
        });
      }
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

  // ─── Generic template (legacy path) ───────────────────────
  const { title } = body;
  const runIds = Array.isArray(body.runIds) ? body.runIds : [];
  const knowledgeIds = Array.isArray(body.knowledgeIds)
    ? body.knowledgeIds
    : [];
  const initiativeIds = Array.isArray(body.initiativeIds)
    ? body.initiativeIds
    : [];

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }
  if (runIds.length + knowledgeIds.length + initiativeIds.length === 0) {
    return NextResponse.json(
      { error: "Select at least one run, fact, or initiative" },
      { status: 400 }
    );
  }

  const [runs, facts, initiatives] = await Promise.all([
    runIds.length > 0
      ? db.agentRun.findMany({
          where: {
            id: { in: runIds },
            workspaceId,
            // Reject orphaned console runs whose conversation has
            // been deleted — no title, no context, shouldn't ship in
            // a client-facing deliverable.
            NOT: { kind: "console", conversationId: null },
          },
          select: {
            id: true,
            kind: true,
            startedAt: true,
            // finalText isn't a column — the last assistant message
            // on the linked conversation holds it. Pull the last
            // assistant message per run, plus the conversation title
            // for a human-friendly section heading.
            conversation: {
              select: {
                title: true,
                messages: {
                  where: { role: "assistant" },
                  orderBy: { ordinal: "desc" },
                  take: 1,
                  select: { content: true },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    knowledgeIds.length > 0
      ? db.workspaceKnowledge.findMany({
          where: { id: { in: knowledgeIds }, workspaceId, isActive: true },
          select: {
            id: true,
            subject: true,
            statement: true,
            kind: true,
            confidence: true,
          },
        })
      : Promise.resolve([]),
    initiativeIds.length > 0
      ? db.initiative.findMany({
          where: { id: { in: initiativeIds }, workspaceId },
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            horizon: true,
            priority: true,
          },
        })
      : Promise.resolve([]),
  ]);

  // Reject if the caller tried to pass ids outside their workspace.
  if (
    runs.length !== runIds.length ||
    facts.length !== knowledgeIds.length ||
    initiatives.length !== initiativeIds.length
  ) {
    return NextResponse.json(
      {
        error:
          "One or more referenced ids don't belong to this workspace",
      },
      { status: 403 }
    );
  }

  const workspaceLabel =
    workspace.clientName?.trim() || workspace.name;

  try {
    const result = await buildDeliverableDocx({
      title: title.trim(),
      workspaceLabel,
      runs: runs.map((r) => ({
        id: r.id,
        kind: r.kind,
        label: r.conversation?.title?.trim() || r.kind,
        startedAt: r.startedAt,
        finalText: r.conversation?.messages[0]?.content ?? "",
      })),
      facts,
      initiatives,
    });

    const filename = `${slugify(title)}.docx`;
    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
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

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "deliverable"
  );
}
