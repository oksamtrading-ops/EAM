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

  const [apps, interfaces, layout, annotations] = await Promise.all([
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
    db.diagramLayout.findUnique({
      where: { workspaceId_scenario: { workspaceId, scenario } },
    }),
    db.diagramAnnotation.findMany({
      where: { workspaceId, scenario },
      orderBy: [{ z: "asc" }, { createdAt: "asc" }],
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

  // ── Slide 2b: Editable shapes (native PPTX) ────────
  addEditableShapesSlide(pptx, {
    apps,
    interfaces,
    annotations,
    nodePositions: (layout?.nodePositions as Record<string, { x: number; y: number }>) ?? {},
    nodeSizes: (layout?.nodeSizes as Record<string, { w: number; h: number }>) ?? {},
    defaultNodeW: layout?.defaultNodeW ?? 160,
    defaultNodeH: layout?.defaultNodeH ?? 56,
    title: "Architecture — Editable Shapes",
  });

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

// ──────────────────────────────────────────────────────────
// Editable shapes slide — renders apps, annotations, and
// interfaces as native PowerPoint shapes.
// ──────────────────────────────────────────────────────────
function addEditableShapesSlide(
  pptx: PptxGenJS,
  args: {
    apps: Array<{ id: string; name: string; lifecycle: string; vendor: string | null }>;
    interfaces: Array<{
      id: string;
      sourceAppId: string;
      targetAppId: string;
      criticality: string;
      reviewStatus: string;
    }>;
    annotations: Array<{
      id: string;
      type: string;
      x: number;
      y: number;
      width: number | null;
      height: number | null;
      text: string | null;
      strokeColor: string | null;
      fillColor: string | null;
      strokeWidth: number | null;
      strokeStyle: string | null;
      sourceAnchor: any;
      targetAnchor: any;
      waypoints: any;
      headTarget: boolean;
    }>;
    nodePositions: Record<string, { x: number; y: number }>;
    nodeSizes: Record<string, { w: number; h: number }>;
    defaultNodeW: number;
    defaultNodeH: number;
    title: string;
  }
) {
  const { apps, interfaces, annotations, nodePositions, nodeSizes, defaultNodeW, defaultNodeH, title } = args;

  // Bounding box of all content in flow coords
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // auto-layout fallback — match canvas: GRID_COLS=6, H_GAP=220, V_GAP=120
  const autoPos: Record<string, { x: number; y: number }> = {};
  apps.forEach((a, i) => {
    autoPos[a.id] = { x: (i % 6) * 220, y: Math.floor(i / 6) * 120 };
  });

  const appBounds = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const a of apps) {
    const p = nodePositions[a.id] ?? autoPos[a.id] ?? { x: 0, y: 0 };
    const s = nodeSizes[a.id] ?? { w: defaultNodeW, h: defaultNodeH };
    appBounds.set(a.id, { x: p.x, y: p.y, w: s.w, h: s.h });
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + s.w);
    maxY = Math.max(maxY, p.y + s.h);
  }
  const annBounds = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const ann of annotations) {
    if (ann.type === "LINE" || ann.type === "ARROW") continue;
    const w = ann.width ?? 160;
    const h = ann.height ?? 80;
    annBounds.set(ann.id, { x: ann.x, y: ann.y, w, h });
    minX = Math.min(minX, ann.x);
    minY = Math.min(minY, ann.y);
    maxX = Math.max(maxX, ann.x + w);
    maxY = Math.max(maxY, ann.y + h);
  }
  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 100;
    maxY = 100;
  }

  // Slide content area: 12.3 x 6.3 inches with 0.5 inch left margin, 0.9 top
  const slideX = 0.5;
  const slideY = 0.9;
  const slideW = 12.3;
  const slideH = 6.3;
  const contentW = Math.max(1, maxX - minX);
  const contentH = Math.max(1, maxY - minY);
  const scale = Math.min(slideW / contentW, slideH / contentH);

  // Center within slide area
  const offsetX = slideX + (slideW - contentW * scale) / 2;
  const offsetY = slideY + (slideH - contentH * scale) / 2;

  function fx(x: number): number {
    return offsetX + (x - minX) * scale;
  }
  function fy(y: number): number {
    return offsetY + (y - minY) * scale;
  }
  function fw(w: number): number {
    return Math.max(0.1, w * scale);
  }

  function resolveAnchor(
    anchor: any
  ): { x: number; y: number } | null {
    if (!anchor) return null;
    if (anchor.kind === "FREE") {
      return { x: typeof anchor.x === "number" ? anchor.x : 0, y: typeof anchor.y === "number" ? anchor.y : 0 };
    }
    const bounds =
      anchor.kind === "APP" ? appBounds.get(anchor.refId) : annBounds.get(anchor.refId);
    if (!bounds) return null;
    switch (anchor.handle) {
      case "t":
        return { x: bounds.x + bounds.w / 2, y: bounds.y };
      case "b":
        return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h };
      case "l":
        return { x: bounds.x, y: bounds.y + bounds.h / 2 };
      case "r":
        return { x: bounds.x + bounds.w, y: bounds.y + bounds.h / 2 };
      default:
        return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
    }
  }

  function sideCenter(b: { x: number; y: number; w: number; h: number }, side: "t" | "l" | "r" | "b") {
    switch (side) {
      case "t":
        return { x: b.x + b.w / 2, y: b.y };
      case "b":
        return { x: b.x + b.w / 2, y: b.y + b.h };
      case "l":
        return { x: b.x, y: b.y + b.h / 2 };
      case "r":
        return { x: b.x + b.w, y: b.y + b.h / 2 };
    }
  }

  const s = pptx.addSlide();
  s.addText(title, {
    x: 0.5, y: 0.2, w: 12.5, h: 0.5,
    fontSize: 20, fontFace: "Arial", color: "1a1f2e", bold: true,
  });

  // Draw annotation shapes first (below apps)
  for (const ann of annotations) {
    if (ann.type === "LINE" || ann.type === "ARROW") continue;
    const b = annBounds.get(ann.id);
    if (!b) continue;
    const x = fx(b.x);
    const y = fy(b.y);
    const w = fw(b.w);
    const h = fw(b.h);
    const stroke = stripHash(ann.strokeColor) ?? "334155";
    const fill = ann.fillColor ? stripHash(ann.fillColor) : undefined;
    const strokeW = Math.max(0.25, (ann.strokeWidth ?? 2) * 0.5);
    const dash = ann.strokeStyle === "dashed" ? "dash" : ann.strokeStyle === "dotted" ? "dot" : undefined;
    let shape: any = pptx.ShapeType.rect;
    if (ann.type === "CIRCLE") shape = pptx.ShapeType.ellipse;
    if (ann.type === "CYLINDER") shape = pptx.ShapeType.can;
    if (ann.type === "CLOUD") shape = pptx.ShapeType.cloud;
    if (ann.type === "NOTE") shape = pptx.ShapeType.rect;
    if (ann.type === "CONTAINER") shape = pptx.ShapeType.rect;

    s.addShape(shape, {
      x, y, w, h,
      fill: fill ? { color: fill } : { type: "none" } as any,
      line: { color: stroke, width: strokeW, dashType: dash as any },
    });
    if (ann.text && ann.text.trim()) {
      s.addText(ann.text, {
        x, y, w, h,
        fontSize: 10, fontFace: "Arial",
        color: ann.type === "NOTE" ? "78350f" : stroke,
        align: ann.type === "CONTAINER" ? "left" : "center",
        valign: ann.type === "CONTAINER" ? "top" : "middle",
        margin: 0.08,
      });
    }
  }

  // Apps (rectangles with lifecycle-coloured border)
  for (const a of apps) {
    const b = appBounds.get(a.id);
    if (!b) continue;
    const x = fx(b.x);
    const y = fy(b.y);
    const w = fw(b.w);
    const h = fw(b.h);
    const stroke = LIFECYCLE_FILL[a.lifecycle] ?? "9ca3af";
    s.addShape(pptx.ShapeType.rect, {
      x, y, w, h,
      fill: { color: "FFFFFF" },
      line: { color: stroke, width: 1.25 },
    });
    s.addText(
      [
        { text: a.name, options: { bold: true, fontSize: 10 } },
        ...(a.vendor ? [{ text: `\n${a.vendor}`, options: { fontSize: 8, color: "64748b" } }] : []),
      ] as any,
      {
        x, y, w, h, fontFace: "Arial",
        align: "center", valign: "middle", margin: 0.05,
      }
    );
  }

  // Interface edges — straight line between nearest sides
  for (const iface of interfaces) {
    const src = appBounds.get(iface.sourceAppId);
    const tgt = appBounds.get(iface.targetAppId);
    if (!src || !tgt) continue;
    const side: "r" | "l" | "b" | "t" =
      Math.abs(tgt.x - src.x) >= Math.abs(tgt.y - src.y) ? "r" : "b";
    const srcPt = sideCenter(src, side);
    const tgtSide = side === "r" ? "l" : "t";
    const tgtPt = sideCenter(tgt, tgtSide);
    const color = iface.reviewStatus === "PENDING"
      ? "a855f7"
      : (CRITICALITY_COLOR_HEX[iface.criticality] ?? "2563eb");
    s.addShape(pptx.ShapeType.line, {
      x: Math.min(fx(srcPt.x), fx(tgtPt.x)),
      y: Math.min(fy(srcPt.y), fy(tgtPt.y)),
      w: Math.abs(fx(tgtPt.x) - fx(srcPt.x)),
      h: Math.abs(fy(tgtPt.y) - fy(srcPt.y)),
      flipH: tgtPt.x < srcPt.x,
      flipV: tgtPt.y < srcPt.y,
      line: {
        color,
        width: 1,
        endArrowType: "triangle",
        dashType: iface.reviewStatus === "PENDING" ? "dash" : undefined,
      },
    } as any);
  }

  // Line / Arrow annotations — native line shapes
  for (const ann of annotations) {
    if (ann.type !== "LINE" && ann.type !== "ARROW") continue;
    const src = resolveAnchor(ann.sourceAnchor);
    const tgt = resolveAnchor(ann.targetAnchor);
    if (!src || !tgt) continue;
    const color = stripHash(ann.strokeColor) ?? "334155";
    const strokeW = Math.max(0.25, (ann.strokeWidth ?? 2) * 0.5);
    const dash = ann.strokeStyle === "dashed" ? "dash" : ann.strokeStyle === "dotted" ? "dot" : undefined;
    s.addShape(pptx.ShapeType.line, {
      x: Math.min(fx(src.x), fx(tgt.x)),
      y: Math.min(fy(src.y), fy(tgt.y)),
      w: Math.abs(fx(tgt.x) - fx(src.x)),
      h: Math.abs(fy(tgt.y) - fy(src.y)),
      flipH: tgt.x < src.x,
      flipV: tgt.y < src.y,
      line: {
        color,
        width: strokeW,
        dashType: dash as any,
        endArrowType: ann.type === "ARROW" && ann.headTarget !== false ? "triangle" : undefined,
      },
    } as any);
  }
}

function stripHash(c: string | null | undefined): string | undefined {
  if (!c) return undefined;
  return c.startsWith("#") ? c.slice(1) : c;
}
