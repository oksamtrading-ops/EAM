import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import PptxGenJS from "pptxgenjs";

type Scenario = "AS_IS" | "TO_BE";

const CRITICALITY_COLOR_HEX: Record<string, string> = {
  INT_CRITICAL: "e11d48",
  INT_HIGH: "ea580c",
  INT_MEDIUM: "2563eb",
  INT_LOW: "6b7280",
};

const LIFECYCLE_FILL: Record<string, string> = {
  PLANNED: "3b82f6",
  ACTIVE: "10b981",
  PHASING_OUT: "f59e0b",
  RETIRED: "9ca3af",
  SUNSET: "ef4444",
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const workspaceId: string | null =
    typeof body?.workspaceId === "string" ? body.workspaceId : null;
  if (!workspaceId) return new Response("workspaceId is required", { status: 400 });

  const scenario: Scenario = body.scenario === "TO_BE" ? "TO_BE" : "AS_IS";
  const pngBase64: string | undefined = body.pngBase64;

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId },
    include: { user: true },
  });
  if (!workspace || workspace.user.clerkId !== userId) {
    return new Response("Forbidden", { status: 403 });
  }

  const [apps, interfaces] = await Promise.all([
    db.application.findMany({
      where: { workspaceId, isActive: true },
      orderBy: { name: "asc" },
    }),
    db.applicationInterface.findMany({
      where: {
        workspaceId,
        isActive: true,
        scenario,
        reviewStatus: { in: ["ACCEPTED", "PENDING"] },
      },
      include: {
        sourceApp: { select: { name: true } },
        targetApp: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const pptx = new PptxGenJS();
  pptx.author = "V2V";
  pptx.title = `${workspace.clientName || workspace.name} — ${scenario === "AS_IS" ? "As-Is" : "To-Be"} Architecture`;
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches

  // ── Slide 1: Title ─────────────────────────────────
  const s1 = pptx.addSlide();
  s1.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: "100%", fill: { color: "1a1f2e" },
  });
  s1.addText(`${scenario === "AS_IS" ? "As-Is" : "To-Be"}\nArchitecture Diagram`, {
    x: 0.8, y: 1.6, w: 11.5, h: 2, fontSize: 36, fontFace: "Arial",
    color: "FFFFFF", bold: true,
  });
  s1.addText(workspace.clientName || workspace.name, {
    x: 0.8, y: 3.6, w: 11.5, h: 0.5, fontSize: 18, fontFace: "Arial", color: "86BC25",
  });
  const acceptedCount = interfaces.filter((i) => i.reviewStatus === "ACCEPTED").length;
  const pendingCount = interfaces.filter((i) => i.reviewStatus === "PENDING").length;
  s1.addText(
    `${apps.length} Applications · ${acceptedCount} Integrations` +
      (pendingCount ? ` · ${pendingCount} Pending AI suggestions` : "") +
      ` · ${new Date().toLocaleDateString()}`,
    { x: 0.8, y: 4.2, w: 11.5, h: 0.4, fontSize: 12, fontFace: "Arial", color: "94a3b8" }
  );

  // ── Slide 2: Diagram image (if client provided a PNG) ─
  if (pngBase64) {
    const s2 = pptx.addSlide();
    s2.addText("Architecture Overview", {
      x: 0.5, y: 0.2, w: 12.5, h: 0.5,
      fontSize: 20, fontFace: "Arial", color: "1a1f2e", bold: true,
    });
    try {
      s2.addImage({
        data: pngBase64.startsWith("data:") ? pngBase64 : `data:image/png;base64,${pngBase64}`,
        x: 0.5, y: 0.9, w: 12.3, h: 6.3,
        sizing: { type: "contain", w: 12.3, h: 6.3 },
      });
    } catch {
      s2.addText("(Diagram image unavailable)", {
        x: 0.5, y: 3.5, w: 12.5, h: 0.5, fontSize: 14, color: "94a3b8", align: "center",
      });
    }
  }

  // ── Slide 3: Integrations table ────────────────────
  const s3 = pptx.addSlide();
  s3.addText("Integrations", {
    x: 0.5, y: 0.2, w: 12.5, h: 0.5,
    fontSize: 20, fontFace: "Arial", color: "1a1f2e", bold: true,
  });

  const rows: any[][] = [
    [
      hdr("Source"), hdr("Target"), hdr("Name"),
      hdr("Protocol"), hdr("Criticality"), hdr("Status"),
    ],
  ];
  for (const i of interfaces.slice(0, 40)) {
    const critColor = CRITICALITY_COLOR_HEX[i.criticality] ?? "6b7280";
    rows.push([
      { text: i.sourceApp.name, options: { fontSize: 9 } },
      { text: i.targetApp.name, options: { fontSize: 9 } },
      { text: i.name, options: { fontSize: 9 } },
      { text: i.protocol.replace(/_/g, " "), options: { fontSize: 9, color: "64748b" } },
      {
        text: i.criticality.replace("INT_", ""),
        options: { fontSize: 9, bold: true, color: critColor },
      },
      { text: i.reviewStatus, options: { fontSize: 9 } },
    ]);
  }
  s3.addTable(rows, {
    x: 0.5, y: 0.9, w: 12.3,
    border: { type: "solid", color: "e9ecef", pt: 0.5 },
    colW: [2.4, 2.4, 2.9, 1.4, 1.4, 1.8], rowH: 0.3, autoPage: true,
  });

  // ── Slide 4: Application roster ────────────────────
  const s4 = pptx.addSlide();
  s4.addText("Applications", {
    x: 0.5, y: 0.2, w: 12.5, h: 0.5,
    fontSize: 20, fontFace: "Arial", color: "1a1f2e", bold: true,
  });
  const appRows: any[][] = [[hdr("Name"), hdr("Vendor"), hdr("Type"), hdr("Lifecycle"), hdr("Role")]];
  for (const a of apps.slice(0, 40)) {
    const lifecycleColor = LIFECYCLE_FILL[a.lifecycle] ?? "9ca3af";
    appRows.push([
      { text: a.name, options: { fontSize: 9 } },
      { text: a.vendor ?? "—", options: { fontSize: 9, color: "64748b" } },
      { text: a.applicationType, options: { fontSize: 9 } },
      {
        text: a.lifecycle,
        options: { fontSize: 9, bold: true, color: lifecycleColor },
      },
      { text: a.systemLandscapeRole ?? "—", options: { fontSize: 9, color: "64748b" } },
    ]);
  }
  s4.addTable(appRows, {
    x: 0.5, y: 0.9, w: 12.3,
    border: { type: "solid", color: "e9ecef", pt: 0.5 },
    colW: [3.0, 2.4, 2.0, 2.0, 2.9], rowH: 0.3, autoPage: true,
  });

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  const uint8 = new Uint8Array(buffer);
  const filename = `Architecture_${scenario}.pptx`;

  return new Response(uint8, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function hdr(text: string) {
  return {
    text,
    options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } },
  };
}
