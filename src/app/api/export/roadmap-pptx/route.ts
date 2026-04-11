import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import PptxGenJS from "pptxgenjs";
import { format } from "date-fns";

const BRAND_GREEN = "86BC25";
const DARK_BG = "1a1f2e";
const SLIDE_W = 10;
const SLIDE_H = 5.625;

const HORIZON_LABELS: Record<string, string> = {
  H1_NOW: "H1 — Now (0–6 months)",
  H2_NEXT: "H2 — Next (6–18 months)",
  H3_LATER: "H3 — Later (18–36 months)",
  BEYOND: "Beyond (36+ months)",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "9ca3af",
  PLANNED: "60a5fa",
  IN_PROGRESS: "22c55e",
  ON_HOLD: "facc15",
  COMPLETE: "15803d",
  CANCELLED: "d1d5db",
};

const RAG_COLORS: Record<string, string> = {
  GREEN: "22c55e",
  AMBER: "f59e0b",
  RED: "ef4444",
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

  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : null;
  if (!workspaceId) return new Response("workspaceId is required", { status: 400 });

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId },
    include: { user: true },
  });
  if (!workspace || workspace.user.clerkId !== userId) {
    return new Response("Forbidden", { status: 403 });
  }

  const ws = workspace;
  const [initiatives, objectives, archStates] = await Promise.all([
    db.initiative.findMany({
      where: { workspaceId, isActive: true },
      include: {
        milestones: { orderBy: { dueDate: "asc" } },
        capabilities: true,
        applications: true,
        dependsOn: true,
        tags: { include: { tag: true } },
      },
      orderBy: [{ horizon: "asc" }, { startDate: "asc" }],
    }),
    db.objective.findMany({
      where: { workspaceId, isActive: true },
      include: {
        initiatives: {
          include: {
            initiative: { select: { id: true, name: true, status: true, progressPct: true } },
          },
        },
      },
    }),
    db.architectureState.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  function titleSlide(pptx: PptxGenJS) {
    const slide = pptx.addSlide();
    slide.background = { color: DARK_BG };
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 0.08,
      h: SLIDE_H,
      fill: { color: BRAND_GREEN },
    });
    slide.addText("Transformation Roadmap", {
      x: 0.5,
      y: 1.8,
      w: 9,
      h: 0.8,
      fontSize: 32,
      bold: true,
      color: "FFFFFF",
    });
    slide.addText(ws.clientName ?? ws.name, {
      x: 0.5,
      y: 2.7,
      w: 9,
      h: 0.5,
      fontSize: 18,
      color: BRAND_GREEN,
    });
    slide.addText(format(new Date(), "MMMM yyyy"), {
      x: 0.5,
      y: 3.3,
      w: 9,
      h: 0.4,
      fontSize: 12,
      color: "94a3b8",
    });
  }

  function objectivesSlide(pptx: PptxGenJS) {
    const slide = pptx.addSlide();
    addSlideHeader(slide, pptx, "Strategic Objectives");

    if (objectives.length === 0) {
      slide.addText("No objectives defined.", { x: 0.5, y: 1.5, w: 9, h: 0.4, fontSize: 12, color: "94a3b8" });
      return;
    }

    const rows: any[][] = [
      [
        { text: "Objective", options: { bold: true } },
        { text: "KPI", options: { bold: true } },
        { text: "Target", options: { bold: true } },
        { text: "Initiatives", options: { bold: true } },
        { text: "Avg Progress", options: { bold: true } },
      ],
    ];

    objectives.forEach((o) => {
      const avgPct =
        o.initiatives.length > 0
          ? Math.round(
              o.initiatives.reduce((s, i) => s + i.initiative.progressPct, 0) /
                o.initiatives.length
            )
          : 0;
      rows.push([
        o.name,
        o.kpiDescription ?? "—",
        o.kpiTarget ?? "—",
        o.initiatives.length.toString(),
        `${avgPct}%`,
      ]);
    });

    slide.addTable(rows, {
      x: 0.5,
      y: 1.2,
      w: 9,
      colW: [3, 2, 1.5, 1.2, 1.3],
      fontSize: 10,
      border: { type: "solid", color: "e2e8f0", pt: 0.5 },
      fill: { color: "FFFFFF" } as any,
    });
  }

  function roadmapLaneSlide(pptx: PptxGenJS) {
    const slide = pptx.addSlide();
    addSlideHeader(slide, pptx, "Transformation Roadmap — Horizon View");

    const H_ZONES = [
      { key: "H1_NOW", label: "H1 — Now", x: 0.5, w: 2.8 },
      { key: "H2_NEXT", label: "H2 — Next", x: 3.5, w: 3.2 },
      { key: "H3_LATER", label: "H3 — Later", x: 6.8, w: 2.7 },
    ];

    H_ZONES.forEach((z) => {
      slide.addShape(pptx.ShapeType.rect, {
        x: z.x,
        y: 1.1,
        w: z.w,
        h: 0.35,
        fill: { color: BRAND_GREEN },
      });
      slide.addText(z.label, {
        x: z.x,
        y: 1.1,
        w: z.w,
        h: 0.35,
        align: "center",
        fontSize: 9,
        bold: true,
        color: "FFFFFF",
      });
    });

    let yOff = 1.55;
    initiatives.slice(0, 10).forEach((i) => {
      const zone = H_ZONES.find((z) => z.key === i.horizon) ?? H_ZONES[1];
      const color = STATUS_COLORS[i.status] ?? "94a3b8";
      const rag = RAG_COLORS[i.ragStatus] ?? "22c55e";

      slide.addShape(pptx.ShapeType.roundRect, {
        x: zone.x + 0.05,
        y: yOff,
        w: zone.w - 0.1,
        h: 0.38,
        fill: { color },
        rectRadius: 0.06,
      });
      slide.addShape(pptx.ShapeType.ellipse, {
        x: zone.x + 0.12,
        y: yOff + 0.13,
        w: 0.12,
        h: 0.12,
        fill: { color: rag },
      });
      slide.addText(i.name, {
        x: zone.x + 0.28,
        y: yOff + 0.06,
        w: zone.w - 0.4,
        h: 0.28,
        fontSize: 8,
        bold: true,
        color: "FFFFFF",
        align: "left",
      });
      yOff += 0.44;
      if (yOff > 5.0) yOff = 1.55; // wrap if too many
    });
  }

  function initiativeCardsSlides(pptx: PptxGenJS) {
    for (const initiative of initiatives.slice(0, 12)) {
      const slide = pptx.addSlide();
      addSlideHeader(slide, pptx, initiative.name);

      const ragColor = RAG_COLORS[initiative.ragStatus] ?? "22c55e";
      slide.addShape(pptx.ShapeType.ellipse, {
        x: 0.5,
        y: 1.15,
        w: 0.18,
        h: 0.18,
        fill: { color: ragColor },
      });

      slide.addText(
        [
          { text: initiative.category, options: { color: "94a3b8", fontSize: 9 } },
          { text: "  •  ", options: { color: "94a3b8", fontSize: 9 } },
          {
            text: HORIZON_LABELS[initiative.horizon] ?? initiative.horizon,
            options: { color: BRAND_GREEN, fontSize: 9, bold: true },
          },
        ],
        { x: 0.75, y: 1.12, w: 8, h: 0.25 }
      );

      if (initiative.description) {
        slide.addText(initiative.description, {
          x: 0.5,
          y: 1.45,
          w: 9,
          h: 0.8,
          fontSize: 10,
          color: "374151",
          wrap: true,
        });
      }

      // Progress bar background
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.5,
        y: 2.35,
        w: 9,
        h: 0.2,
        fill: { color: "e2e8f0" },
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.5,
        y: 2.35,
        w: Math.max(0.01, 9 * (initiative.progressPct / 100)),
        h: 0.2,
        fill: { color: BRAND_GREEN },
      });
      slide.addText(`${initiative.progressPct}% complete`, {
        x: 0.5,
        y: 2.6,
        w: 2,
        h: 0.2,
        fontSize: 8,
        color: "94a3b8",
      });

      // Milestones
      if (initiative.milestones.length > 0) {
        slide.addText("Milestones", {
          x: 0.5,
          y: 2.9,
          w: 9,
          h: 0.25,
          fontSize: 9,
          bold: true,
          color: "374151",
        });
        const milRows: any[][] = initiative.milestones.slice(0, 5).map((m) => [
          m.name,
          m.status.replace("_", " "),
          m.dueDate ? format(new Date(m.dueDate), "MMM d, yyyy") : "TBD",
          m.isCritical ? "Critical" : "",
        ]);
        slide.addTable(milRows, {
          x: 0.5,
          y: 3.2,
          w: 9,
          colW: [4.5, 1.5, 1.8, 1.2],
          fontSize: 9,
          border: { type: "solid", color: "e2e8f0", pt: 0.5 },
        });
      }
    }
  }

  function riskSummarySlide(pptx: PptxGenJS) {
    const slide = pptx.addSlide();
    addSlideHeader(slide, pptx, "Risk Register Summary");

    const atRisk = initiatives.filter(
      (i) => i.ragStatus === "RED" || i.ragStatus === "AMBER"
    );

    if (atRisk.length === 0) {
      slide.addText("All initiatives are currently GREEN. No risks flagged.", {
        x: 0.5,
        y: 2,
        w: 9,
        h: 0.5,
        fontSize: 12,
        color: "22c55e",
      });
      return;
    }

    const rows: any[][] = [
      [
        { text: "Initiative", options: { bold: true } },
        { text: "Horizon", options: { bold: true } },
        { text: "Status", options: { bold: true } },
        { text: "RAG", options: { bold: true } },
      ],
    ];

    atRisk.forEach((i) => {
      rows.push([
        i.name,
        HORIZON_LABELS[i.horizon] ?? i.horizon,
        i.status.replace("_", " "),
        { text: i.ragStatus, options: { color: RAG_COLORS[i.ragStatus] ?? "94a3b8", bold: true } },
      ]);
    });

    slide.addTable(rows, {
      x: 0.5,
      y: 1.2,
      w: 9,
      colW: [4, 2.5, 1.5, 1],
      fontSize: 10,
      border: { type: "solid", color: "e2e8f0", pt: 0.5 },
    });
  }

  function nextStepsSlide(pptx: PptxGenJS) {
    const slide = pptx.addSlide();
    addSlideHeader(slide, pptx, "Recommended Next Steps");

    const h1 = initiatives.filter((i) => i.horizon === "H1_NOW");
    const bullets = [
      h1.length > 0
        ? `Kick off ${h1.length} H1 initiative${h1.length > 1 ? "s" : ""}: ${h1
            .slice(0, 3)
            .map((i) => i.name)
            .join(", ")}`
        : "Define H1 quick-win initiatives to build early momentum",
      "Capture As-Is architecture baseline to formalise current state",
      "Define To-Be target states for each transformation initiative",
      "Establish milestone owners and RAG reporting cadence",
      "Complete dependency mapping to identify critical path",
    ];

    bullets.forEach((b, idx) => {
      slide.addShape(pptx.ShapeType.ellipse, {
        x: 0.5,
        y: 1.3 + idx * 0.65,
        w: 0.22,
        h: 0.22,
        fill: { color: BRAND_GREEN },
      });
      slide.addText((idx + 1).toString(), {
        x: 0.5,
        y: 1.3 + idx * 0.65,
        w: 0.22,
        h: 0.22,
        align: "center",
        fontSize: 9,
        bold: true,
        color: "FFFFFF",
      });
      slide.addText(b, {
        x: 0.85,
        y: 1.28 + idx * 0.65,
        w: 8.6,
        h: 0.26,
        fontSize: 11,
        color: "1f2937",
      });
    });
  }

  function addSlideHeader(slide: any, pptx: PptxGenJS, title: string) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: SLIDE_W,
      h: 0.9,
      fill: { color: DARK_BG },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0.9,
      w: SLIDE_W,
      h: 0.04,
      fill: { color: BRAND_GREEN },
    });
    slide.addText(title, {
      x: 0.5,
      y: 0.15,
      w: 9,
      h: 0.65,
      fontSize: 18,
      bold: true,
      color: "FFFFFF",
    });
    slide.addText(ws.clientName ?? ws.name, {
      x: 7,
      y: 0.25,
      w: 2.8,
      h: 0.4,
      fontSize: 9,
      color: BRAND_GREEN,
      align: "right",
    });
  }

  // Build slides
  titleSlide(pptx);
  objectivesSlide(pptx);
  roadmapLaneSlide(pptx);
  initiativeCardsSlides(pptx);
  riskSummarySlide(pptx);
  nextStepsSlide(pptx);

  const buffer = await pptx.write({ outputType: "arraybuffer" }) as ArrayBuffer;

  return new Response(Buffer.from(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="Transformation_Roadmap_${ws.clientName ?? ws.name}.pptx"`,
    },
  });
}
