import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import PptxGenJS from "pptxgenjs";
import { format } from "date-fns";
import { scoreLabel } from "@/server/services/riskScoring";

const BRAND_GREEN = "86BC25";
const DARK_BG = "1a1f2e";
const SLIDE_W = 10;
const SLIDE_H = 5.625;

const RING_COLORS: Record<string, string> = {
  ADOPT: "3B6D11",
  TRIAL: "185FA5",
  ASSESS: "BA7517",
  HOLD: "A32D2D",
};

const URGENCY_COLORS: Record<string, string> = {
  EXPIRED: "ef4444",
  URGENT: "ef4444",
  WARNING: "f97316",
  APPROACHING: "eab308",
  PLANNED: "3b82f6",
  HEALTHY: "22c55e",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "ef4444",
  IN_PROGRESS: "3b82f6",
  MITIGATED: "22c55e",
  ACCEPTED: "a3a3a3",
  CLOSED: "166534",
};

function addTitleSlide(pptx: PptxGenJS, clientName: string, date: string) {
  const slide = pptx.addSlide();
  slide.background = { color: DARK_BG };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.4, h: SLIDE_H, fill: { color: BRAND_GREEN },
  });
  slide.addText("Technology Risk & Compliance", {
    x: 0.7, y: 1.6, w: 8.8, h: 0.8,
    fontSize: 32, bold: true, color: "FFFFFF",
  });
  slide.addText(clientName, {
    x: 0.7, y: 2.55, w: 8.8, h: 0.5,
    fontSize: 20, color: BRAND_GREEN,
  });
  slide.addText(date, {
    x: 0.7, y: 3.3, w: 8.8, h: 0.4,
    fontSize: 14, color: "AAAAAA",
  });
  slide.addText("Confidential — Enterprise Architecture Management Platform", {
    x: 0.7, y: SLIDE_H - 0.5, w: 9, h: 0.35,
    fontSize: 10, color: "666666",
  });
}

function addSectionHeader(pptx: PptxGenJS, title: string, subtitle?: string) {
  const slide = pptx.addSlide();
  slide.background = { color: "F8F9FA" };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.08, h: SLIDE_H, fill: { color: BRAND_GREEN },
  });
  slide.addText(title, {
    x: 0.6, y: 1.8, w: 9, h: 0.9,
    fontSize: 26, bold: true, color: "1A1F2E",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.6, y: 2.85, w: 9, h: 0.5,
      fontSize: 14, color: "666666",
    });
  }
  return slide;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  let body: any;
  try { body = await req.json(); } catch {
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

  const aiNarrative: string = body?.aiNarrative ?? "";
  const aiActions: string = body?.aiActions ?? "";

  const [risks, radarEntries, eolEntries, complianceRequirements] = await Promise.all([
    db.techRisk.findMany({
      where: { workspaceId },
      orderBy: [{ riskScore: "desc" }, { identifiedAt: "desc" }],
      take: 50,
    }),
    db.techRadarEntry.findMany({
      where: { workspaceId },
      orderBy: [{ quadrant: "asc" }, { ring: "asc" }],
    }),
    db.eolWatchEntry.findMany({
      where: { workspaceId },
      orderBy: { eolDate: "asc" },
      take: 20,
    }),
    db.complianceRequirement.findMany({
      where: { workspaceId, isApplicable: true },
      include: { mappings: { select: { status: true } } },
    }),
  ]);

  // Compute stats
  const total = risks.length;
  const open = risks.filter((r) => r.status === "OPEN").length;
  const critical = risks.filter((r) => r.riskScore >= 12).length;
  const unmitigated = risks.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS").length;
  const top10 = risks.slice(0, 10);

  // Compliance scorecard
  const frameworkMap: Record<string, { total: number; compliant: number; partial: number; nonCompliant: number; notAssessed: number }> = {};
  for (const req of complianceRequirements) {
    const fw = req.framework;
    if (!frameworkMap[fw]) frameworkMap[fw] = { total: 0, compliant: 0, partial: 0, nonCompliant: 0, notAssessed: 0 };
    frameworkMap[fw].total++;
    if (req.mappings.length === 0) frameworkMap[fw].notAssessed++;
    else if (req.mappings.every((m) => m.status === "COMPLIANT")) frameworkMap[fw].compliant++;
    else if (req.mappings.some((m) => m.status === "NON_COMPLIANT")) frameworkMap[fw].nonCompliant++;
    else if (req.mappings.some((m) => m.status === "PARTIAL")) frameworkMap[fw].partial++;
    else frameworkMap[fw].notAssessed++;
  }
  const scorecardRows = Object.entries(frameworkMap).map(([framework, counts]) => ({
    framework,
    score: counts.total > 0 ? Math.round((counts.compliant / counts.total) * 100) : 0,
    ...counts,
  }));

  const clientName = workspace.clientName || workspace.name;
  const dateStr = format(new Date(), "MMMM yyyy");

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "WIDE";

  // Slide 1 — Title
  addTitleSlide(pptx, clientName, dateStr);

  // Slide 2 — Executive Briefing
  {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.55, fill: { color: DARK_BG } });
    slide.addText("Executive Risk Briefing", { x: 0.4, y: 0.1, w: 9, h: 0.35, fontSize: 16, bold: true, color: "FFFFFF" });
    slide.addText(aiNarrative || "AI-generated narrative not available. Run AI briefing from the Risk module.", {
      x: 0.4, y: 0.75, w: 9.2, h: 4.5,
      fontSize: 11, color: "333333",
      valign: "top", wrap: true,
    });
  }

  // Slide 3 — Risk KPIs
  {
    const slide = pptx.addSlide();
    slide.background = { color: "F8F9FA" };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.55, fill: { color: DARK_BG } });
    slide.addText("Risk Summary", { x: 0.4, y: 0.1, w: 9, h: 0.35, fontSize: 16, bold: true, color: "FFFFFF" });

    const kpis = [
      { label: "Total Risks", value: String(total), color: "333333" },
      { label: "Open Risks", value: String(open), color: "ef4444" },
      { label: "Critical Risks", value: String(critical), color: "7c3aed" },
      { label: "Unmitigated", value: String(unmitigated), color: "f97316" },
    ];
    kpis.forEach((k, i) => {
      const x = 0.3 + i * 2.35;
      slide.addShape(pptx.ShapeType.rect, { x, y: 0.8, w: 2.1, h: 1.4, fill: { color: "FFFFFF" }, line: { color: "E5E7EB", pt: 1 } });
      slide.addText(k.value, { x, y: 0.95, w: 2.1, h: 0.7, fontSize: 32, bold: true, color: k.color, align: "center" });
      slide.addText(k.label, { x, y: 1.7, w: 2.1, h: 0.35, fontSize: 11, color: "6B7280", align: "center" });
    });

    // Category breakdown table
    const byCategory: Record<string, number> = {};
    for (const r of risks) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    const catRows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

    slide.addText("Risks by Category", { x: 0.3, y: 2.45, w: 4.5, h: 0.35, fontSize: 12, bold: true, color: "1A1F2E" });
    const tableRows = [
      [{ text: "Category", options: { bold: true } }, { text: "Count", options: { bold: true } }],
      ...catRows.map(([cat, cnt]) => [
        { text: cat.replace(/_/g, " ") },
        { text: String(cnt) },
      ]),
    ];
    if (tableRows.length > 1) {
      slide.addTable(tableRows as any, {
        x: 0.3, y: 2.85, w: 4.5,
        rowH: 0.28, fontSize: 10,
        border: { type: "solid", pt: 0.5, color: "E5E7EB" },
        fill: { color: "FFFFFF" },
      });
    }

    // Status breakdown
    const byStatus: Record<string, number> = {};
    for (const r of risks) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    slide.addText("Risks by Status", { x: 5.2, y: 2.45, w: 4.5, h: 0.35, fontSize: 12, bold: true, color: "1A1F2E" });
    const statusRows = [
      [{ text: "Status", options: { bold: true } }, { text: "Count", options: { bold: true } }],
      ...Object.entries(byStatus).map(([s, c]) => [{ text: s }, { text: String(c) }]),
    ];
    if (statusRows.length > 1) {
      slide.addTable(statusRows as any, {
        x: 5.2, y: 2.85, w: 4.2,
        rowH: 0.28, fontSize: 10,
        border: { type: "solid", pt: 0.5, color: "E5E7EB" },
        fill: { color: "FFFFFF" },
      });
    }
  }

  // Slide 4 — Risk Heat Map
  {
    const slide = pptx.addSlide();
    slide.background = { color: "F8F9FA" };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.55, fill: { color: DARK_BG } });
    slide.addText("Risk Heat Map", { x: 0.4, y: 0.1, w: 9, h: 0.35, fontSize: 16, bold: true, color: "FFFFFF" });

    const likelihoods = ["HIGH", "MEDIUM", "LOW", "RARE"];
    const impacts = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    const cellW = 1.8;
    const cellH = 0.85;
    const startX = 1.5;
    const startY = 0.75;

    // Impact header
    impacts.forEach((imp, ci) => {
      slide.addText(imp, { x: startX + ci * cellW, y: startY, w: cellW, h: 0.35, fontSize: 9, bold: true, align: "center", color: "333333" });
    });
    slide.addText("Impact →", { x: startX + 0.5, y: startY - 0.15, w: cellW * 4, h: 0.2, fontSize: 8, color: "999999" });

    // Likelihood axis labels
    likelihoods.forEach((lik, ri) => {
      slide.addText(lik, { x: 0.1, y: startY + 0.35 + ri * cellH, w: 1.3, h: cellH, fontSize: 9, bold: true, align: "right", valign: "middle", color: "333333" });
    });
    slide.addText("← Likelihood", { x: 0.05, y: startY + 1.3, w: 0.3, h: 1.5, fontSize: 8, color: "999999" });

    const CELL_COLORS: Record<string, string> = {
      Low: "dcfce7", Medium: "fef9c3", High: "fed7aa", Critical: "fee2e2",
    };

    likelihoods.forEach((lik, ri) => {
      impacts.forEach((imp, ci) => {
        const ls: Record<string, number> = { RARE: 1, LOW: 2, MEDIUM: 3, HIGH: 4 };
        const is: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
        const score = ls[lik] * is[imp];
        const label = scoreLabel(score);
        const count = risks.filter(
          (r) => r.likelihood === lik && r.impact === imp && r.status !== "CLOSED"
        ).length;
        const cellColor = CELL_COLORS[label] ?? "FFFFFF";
        const cx = startX + ci * cellW;
        const cy = startY + 0.35 + ri * cellH;
        slide.addShape(pptx.ShapeType.rect, { x: cx, y: cy, w: cellW, h: cellH, fill: { color: cellColor }, line: { color: "D1D5DB", pt: 0.5 } });
        slide.addText(count > 0 ? String(count) : "—", { x: cx, y: cy, w: cellW, h: cellH * 0.55, fontSize: count > 0 ? 18 : 14, bold: count > 0, align: "center", valign: "bottom", color: count > 0 ? "1a1f2e" : "CBD5E1" });
        slide.addText(label, { x: cx, y: cy + cellH * 0.55, w: cellW, h: cellH * 0.4, fontSize: 8, align: "center", color: "555555" });
      });
    });
  }

  // Slide 5 — Top 10 Risks
  {
    const slide = pptx.addSlide();
    slide.background = { color: "F8F9FA" };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.55, fill: { color: DARK_BG } });
    slide.addText("Top 10 Open Risks", { x: 0.4, y: 0.1, w: 9, h: 0.35, fontSize: 16, bold: true, color: "FFFFFF" });

    if (top10.length > 0) {
      const tableData = [
        [
          { text: "#", options: { bold: true } },
          { text: "Risk Title", options: { bold: true } },
          { text: "Category", options: { bold: true } },
          { text: "Score", options: { bold: true } },
          { text: "Status", options: { bold: true } },
        ],
        ...top10.map((r, i) => [
          { text: String(i + 1) },
          { text: r.title.length > 55 ? r.title.slice(0, 52) + "..." : r.title },
          { text: r.category.replace(/_/g, " ") },
          { text: `${r.riskScore}/16 (${scoreLabel(r.riskScore)})` },
          { text: r.status },
        ]),
      ];
      slide.addTable(tableData as any, {
        x: 0.3, y: 0.7, w: 9.4,
        rowH: 0.38, fontSize: 9,
        border: { type: "solid", pt: 0.5, color: "E5E7EB" },
        fill: { color: "FFFFFF" },
      });
    } else {
      slide.addText("No risks recorded.", { x: 0.4, y: 1.5, w: 9, h: 0.5, fontSize: 14, color: "999999" });
    }
  }

  // Slide 6 — EOL Timeline
  {
    const slide = pptx.addSlide();
    slide.background = { color: "F8F9FA" };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.55, fill: { color: DARK_BG } });
    slide.addText("EOL Exposure Timeline", { x: 0.4, y: 0.1, w: 9, h: 0.35, fontSize: 16, bold: true, color: "FFFFFF" });

    const criticalEol = eolEntries.filter((e) => e.urgencyBand === "EXPIRED" || e.urgencyBand === "URGENT");
    const displayEol = criticalEol.length > 0 ? criticalEol : eolEntries.slice(0, 12);

    if (displayEol.length > 0) {
      const tableData = [
        [
          { text: "Entity", options: { bold: true } },
          { text: "EOL Date", options: { bold: true } },
          { text: "Urgency", options: { bold: true } },
          { text: "Acknowledged", options: { bold: true } },
        ],
        ...displayEol.map((e) => [
          { text: e.entityName },
          { text: e.eolDate ? format(e.eolDate, "MMM d, yyyy") : "—" },
          { text: e.urgencyBand },
          { text: e.isAcknowledged ? "Yes" : "No" },
        ]),
      ];
      slide.addTable(tableData as any, {
        x: 0.3, y: 0.7, w: 9.4,
        rowH: 0.38, fontSize: 10,
        border: { type: "solid", pt: 0.5, color: "E5E7EB" },
        fill: { color: "FFFFFF" },
      });
    } else {
      slide.addText("No EOL entries tracked.", { x: 0.4, y: 1.5, w: 9, h: 0.5, fontSize: 14, color: "999999" });
    }
  }

  // Slide 7 — Tech Radar
  {
    const slide = pptx.addSlide();
    slide.background = { color: "F8F9FA" };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.55, fill: { color: DARK_BG } });
    slide.addText("Technology Radar", { x: 0.4, y: 0.1, w: 9, h: 0.35, fontSize: 16, bold: true, color: "FFFFFF" });

    const byRing: Record<string, typeof radarEntries> = { ADOPT: [], TRIAL: [], ASSESS: [], HOLD: [] };
    for (const e of radarEntries) byRing[e.ring].push(e);

    const ringOrder = ["ADOPT", "TRIAL", "ASSESS", "HOLD"];
    let y = 0.75;
    for (const ring of ringOrder) {
      const entries = byRing[ring];
      if (entries.length === 0) continue;
      slide.addShape(pptx.ShapeType.rect, { x: 0.3, y, w: 1.0, h: 0.28, fill: { color: RING_COLORS[ring] ?? "666666" } });
      slide.addText(ring, { x: 0.3, y, w: 1.0, h: 0.28, fontSize: 9, bold: true, color: "FFFFFF", align: "center" });
      slide.addText(entries.map((e) => e.name).join("  ·  "), {
        x: 1.45, y, w: 8.2, h: 0.28,
        fontSize: 9, color: "333333", wrap: true,
      });
      y += 0.35;
      if (y > 5.2) break;
    }

    if (radarEntries.length === 0) {
      slide.addText("No tech radar entries.", { x: 0.4, y: 1.5, w: 9, h: 0.5, fontSize: 14, color: "999999" });
    }
  }

  // Slide 8 — Compliance Scorecard
  {
    const slide = pptx.addSlide();
    slide.background = { color: "F8F9FA" };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.55, fill: { color: DARK_BG } });
    slide.addText("Compliance Scorecard", { x: 0.4, y: 0.1, w: 9, h: 0.35, fontSize: 16, bold: true, color: "FFFFFF" });

    if (scorecardRows.length > 0) {
      const tableData = [
        [
          { text: "Framework", options: { bold: true } },
          { text: "Score", options: { bold: true } },
          { text: "Compliant", options: { bold: true } },
          { text: "Partial", options: { bold: true } },
          { text: "Non-Compliant", options: { bold: true } },
          { text: "Not Assessed", options: { bold: true } },
          { text: "Total", options: { bold: true } },
        ],
        ...scorecardRows.map((r) => [
          { text: r.framework.replace(/_/g, " ") },
          { text: `${r.score}%` },
          { text: String(r.compliant) },
          { text: String(r.partial) },
          { text: String(r.nonCompliant) },
          { text: String(r.notAssessed) },
          { text: String(r.total) },
        ]),
      ];
      slide.addTable(tableData as any, {
        x: 0.3, y: 0.7, w: 9.4,
        rowH: 0.42, fontSize: 10,
        border: { type: "solid", pt: 0.5, color: "E5E7EB" },
        fill: { color: "FFFFFF" },
      });
    } else {
      slide.addText("No compliance frameworks imported.", { x: 0.4, y: 1.5, w: 9, h: 0.5, fontSize: 14, color: "999999" });
    }
  }

  // Slide 9 — Compliance Gap Highlights
  {
    const slide = pptx.addSlide();
    slide.background = { color: "F8F9FA" };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.55, fill: { color: DARK_BG } });
    slide.addText("Compliance Gap Highlights", { x: 0.4, y: 0.1, w: 9, h: 0.35, fontSize: 16, bold: true, color: "FFFFFF" });

    const gaps = complianceRequirements.filter((r) => {
      if (r.mappings.length === 0) return true;
      return r.mappings.some((m) => m.status === "NON_COMPLIANT" || m.status === "PARTIAL");
    }).slice(0, 12);

    if (gaps.length > 0) {
      const tableData = [
        [
          { text: "Framework", options: { bold: true } },
          { text: "Control", options: { bold: true } },
          { text: "Title", options: { bold: true } },
          { text: "Status", options: { bold: true } },
        ],
        ...gaps.map((g) => {
          const worstStatus = g.mappings.length === 0 ? "NOT_ASSESSED"
            : g.mappings.some((m) => m.status === "NON_COMPLIANT") ? "NON_COMPLIANT"
            : g.mappings.some((m) => m.status === "PARTIAL") ? "PARTIAL"
            : "NOT_ASSESSED";
          return [
            { text: g.framework.replace(/_/g, " ") },
            { text: g.controlId },
            { text: g.title.length > 50 ? g.title.slice(0, 47) + "..." : g.title },
            { text: worstStatus.replace(/_/g, " ") },
          ];
        }),
      ];
      slide.addTable(tableData as any, {
        x: 0.3, y: 0.7, w: 9.4,
        rowH: 0.38, fontSize: 9,
        border: { type: "solid", pt: 0.5, color: "E5E7EB" },
        fill: { color: "FFFFFF" },
      });
    } else {
      slide.addText("No compliance gaps identified.", { x: 0.4, y: 1.5, w: 9, h: 0.5, fontSize: 14, color: "22c55e" });
    }
  }

  // Slide 10 — Recommended Actions
  {
    const slide = pptx.addSlide();
    slide.background = { color: "1A1F2E" };
    slide.addText("Recommended Actions", {
      x: 0.6, y: 0.5, w: 8.8, h: 0.7,
      fontSize: 24, bold: true, color: "FFFFFF",
    });
    slide.addText("90-Day Risk Reduction Priorities", {
      x: 0.6, y: 1.25, w: 8.8, h: 0.4,
      fontSize: 14, color: BRAND_GREEN,
    });

    slide.addText(aiActions || "Run AI gap analysis from the Compliance view to generate specific 90-day action priorities tailored to your risk posture.", {
      x: 0.6, y: 1.9, w: 8.8, h: 3.2,
      fontSize: 11, color: "CCCCCC",
      valign: "top", wrap: true,
    });

    slide.addText(`Generated by V2V · ${format(new Date(), "MMMM d, yyyy")}`, {
      x: 0.6, y: SLIDE_H - 0.4, w: 9, h: 0.3,
      fontSize: 9, color: "666666",
    });
  }

  const buf = await pptx.write({ outputType: "arraybuffer" }) as ArrayBuffer;

  const filename = `risk-compliance-${clientName.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM")}.pptx`;
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
