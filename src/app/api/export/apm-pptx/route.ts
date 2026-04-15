import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import PptxGenJS from "pptxgenjs";
import { RAT_COLORS, RAT_LABELS, BV_LABELS, TH_LABELS, LIFECYCLE_LABELS } from "@/lib/constants/application-colors";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : null;
  if (!workspaceId) return new Response("workspaceId is required", { status: 400 });

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId },
    include: { user: true },
  });
  if (!workspace || workspace.user.clerkId !== userId) {
    return new Response("Forbidden", { status: 403 });
  }

  const apps = await db.application.findMany({
    where: { workspaceId, isActive: true },
    include: { capabilities: true },
    orderBy: { name: "asc" },
  });

  const pptx = new PptxGenJS();
  pptx.author = "V2V";
  pptx.title = `${workspace.clientName || workspace.name} — Application Portfolio`;

  // Slide 1: Title
  const s1 = pptx.addSlide();
  s1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: "1a1f2e" } });
  s1.addText("Application Portfolio\nRationalization Analysis", {
    x: 0.8, y: 1.5, w: 8.4, h: 1.5, fontSize: 28, fontFace: "Arial", color: "FFFFFF", bold: true,
  });
  s1.addText(workspace.clientName || workspace.name, {
    x: 0.8, y: 3, w: 8.4, h: 0.5, fontSize: 16, fontFace: "Arial", color: "86BC25",
  });
  const totalCost = apps.reduce((sum, a) => sum + Number(a.annualCostUsd ?? 0), 0);
  s1.addText(`${apps.length} Applications | $${totalCost.toLocaleString()} Annual IT Spend | ${new Date().toLocaleDateString()}`, {
    x: 0.8, y: 3.6, w: 8.4, h: 0.4, fontSize: 10, fontFace: "Arial", color: "94a3b8",
  });

  // Slide 2: Portfolio Overview stats
  const s2 = pptx.addSlide();
  s2.addText("Portfolio Overview", { x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 20, fontFace: "Arial", color: "1a1f2e", bold: true });

  // Rationalization breakdown
  const ratCounts: Record<string, number> = {};
  for (const app of apps) {
    ratCounts[app.rationalizationStatus] = (ratCounts[app.rationalizationStatus] ?? 0) + 1;
  }

  let xPos = 0.5;
  for (const [status, count] of Object.entries(ratCounts)) {
    const color = RAT_COLORS[status]?.replace("#", "") ?? "cbd5e1";
    s2.addShape(pptx.ShapeType.rect, { x: xPos, y: 1, w: 1.5, h: 1, fill: { color }, rectRadius: 0.1 });
    s2.addText(String(count), { x: xPos, y: 1, w: 1.5, h: 0.7, fontSize: 24, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center", valign: "middle" });
    s2.addText(RAT_LABELS[status] ?? status, { x: xPos, y: 1.65, w: 1.5, h: 0.3, fontSize: 9, fontFace: "Arial", color: "FFFFFF", align: "center" });
    xPos += 1.65;
  }

  // App table
  const tableRows: any[][] = [
    [
      { text: "Application", options: { bold: true, fontSize: 8, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "Vendor", options: { bold: true, fontSize: 8, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "Lifecycle", options: { bold: true, fontSize: 8, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "BV", options: { bold: true, fontSize: 8, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "TH", options: { bold: true, fontSize: 8, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "Status", options: { bold: true, fontSize: 8, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "Cost/yr", options: { bold: true, fontSize: 8, color: "FFFFFF", fill: { color: "1a1f2e" } } },
    ],
  ];

  for (const app of apps.slice(0, 20)) {
    const ratColor = RAT_COLORS[app.rationalizationStatus]?.replace("#", "") ?? "cbd5e1";
    tableRows.push([
      { text: app.name, options: { fontSize: 8 } },
      { text: app.vendor ?? "—", options: { fontSize: 8, color: "64748b" } },
      { text: LIFECYCLE_LABELS[app.lifecycle] ?? app.lifecycle, options: { fontSize: 8 } },
      { text: BV_LABELS[app.businessValue] ?? "?", options: { fontSize: 8 } },
      { text: TH_LABELS[app.technicalHealth] ?? "?", options: { fontSize: 8 } },
      { text: RAT_LABELS[app.rationalizationStatus] ?? "?", options: { fontSize: 8, color: ratColor, bold: true } },
      { text: app.annualCostUsd ? `$${Number(app.annualCostUsd).toLocaleString()}` : "—", options: { fontSize: 8, align: "right" } },
    ]);
  }

  s2.addTable(tableRows, {
    x: 0.5, y: 2.5, w: 9, border: { type: "solid", color: "e9ecef", pt: 0.5 },
    colW: [2.5, 1.3, 1, 0.8, 0.8, 1, 1.1], rowH: 0.3, autoPage: true,
  });

  // Slide 3: Eliminate/Migrate Candidates
  const retireCandidates = apps.filter(
    (a) => a.rationalizationStatus === "ELIMINATE" || a.rationalizationStatus === "MIGRATE"
  );
  if (retireCandidates.length > 0) {
    const s3 = pptx.addSlide();
    s3.addText("Rationalization Candidates", { x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 20, fontFace: "Arial", color: "1a1f2e", bold: true });
    s3.addText(`${retireCandidates.length} applications flagged for retirement or migration`, {
      x: 0.5, y: 0.7, w: 9, h: 0.3, fontSize: 10, fontFace: "Arial", color: "64748b",
    });

    const candRows: any[][] = [
      [
        { text: "Application", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
        { text: "Action", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
        { text: "Annual Cost", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
        { text: "Rationale", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      ],
    ];

    for (const app of retireCandidates) {
      candRows.push([
        { text: app.name, options: { fontSize: 9 } },
        { text: RAT_LABELS[app.rationalizationStatus] ?? "?", options: { fontSize: 9, bold: true, color: RAT_COLORS[app.rationalizationStatus]?.replace("#", "") ?? "000000" } },
        { text: app.annualCostUsd ? `$${Number(app.annualCostUsd).toLocaleString()}` : "—", options: { fontSize: 9 } },
        { text: app.rationalizationNotes ?? `${BV_LABELS[app.businessValue] ?? "?"} value, ${TH_LABELS[app.technicalHealth] ?? "?"} health`, options: { fontSize: 8, color: "64748b" } },
      ]);
    }

    s3.addTable(candRows, {
      x: 0.5, y: 1.2, w: 9, border: { type: "solid", color: "e9ecef", pt: 0.5 },
      colW: [2.5, 1.2, 1.5, 3.8], rowH: 0.35,
    });
  }

  const buffer = await pptx.write({ outputType: "nodebuffer" }) as Buffer;
  const uint8 = new Uint8Array(buffer);

  return new Response(uint8, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="Application_Portfolio.pptx"`,
    },
  });
}
