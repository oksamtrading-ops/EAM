import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import PptxGenJS from "pptxgenjs";

const MATURITY_COLORS: Record<string, string> = {
  OPTIMIZING: "16a34a",
  MANAGED: "65a30d",
  DEFINED: "ca8a04",
  DEVELOPING: "ea580c",
  INITIAL: "dc2626",
  NOT_ASSESSED: "94a3b8",
};

const MATURITY_LABELS: Record<string, string> = {
  INITIAL: "1 - Initial",
  DEVELOPING: "2 - Developing",
  DEFINED: "3 - Defined",
  MANAGED: "4 - Managed",
  OPTIMIZING: "5 - Optimizing",
  NOT_ASSESSED: "N/A",
};

const IMPORTANCE_LABELS: Record<string, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  NOT_ASSESSED: "N/A",
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

  const capabilities = await db.businessCapability.findMany({
    where: { workspaceId, isActive: true },
    include: {
      tags: { include: { tag: true } },
      organization: { select: { name: true } },
    },
    orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  // Build tree
  const map = new Map(capabilities.map((c) => [c.id, { ...c, children: [] as any[] }]));
  const roots: any[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Generate PPTX
  const pptx = new PptxGenJS();
  pptx.author = "EAM Platform";
  pptx.title = `${workspace.clientName || workspace.name} — Business Capability Map`;

  // ── Slide 1: Title
  const slide1 = pptx.addSlide();
  slide1.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: "100%", fill: { color: "1a1f2e" },
  });
  slide1.addText("Business Capability Map", {
    x: 0.8, y: 1.5, w: 8.4, h: 1,
    fontSize: 32, fontFace: "Arial", color: "FFFFFF", bold: true,
  });
  slide1.addText(workspace.clientName || workspace.name, {
    x: 0.8, y: 2.5, w: 8.4, h: 0.6,
    fontSize: 18, fontFace: "Arial", color: "86BC25",
  });
  slide1.addText(
    `Industry: ${workspace.industry} | ${capabilities.length} Capabilities | Generated ${new Date().toLocaleDateString()}`,
    {
      x: 0.8, y: 3.3, w: 8.4, h: 0.5,
      fontSize: 11, fontFace: "Arial", color: "94a3b8",
    }
  );
  slide1.addText("EAM Platform", {
    x: 0.8, y: 4.8, w: 3, h: 0.4,
    fontSize: 10, fontFace: "Arial", color: "86BC25",
  });

  // ── Slide 2: Capability Overview (heat map grid)
  const slide2 = pptx.addSlide();
  slide2.addText("Capability Overview — Maturity Heat Map", {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 18, fontFace: "Arial", color: "1a1f2e", bold: true,
  });

  // Legend
  const legendItems = Object.entries(MATURITY_LABELS).filter(([k]) => k !== "NOT_ASSESSED");
  legendItems.forEach(([key, label], i) => {
    slide2.addShape(pptx.ShapeType.rect, {
      x: 0.5 + i * 1.7, y: 0.75, w: 0.2, h: 0.2,
      fill: { color: MATURITY_COLORS[key] },
    });
    slide2.addText(label, {
      x: 0.75 + i * 1.7, y: 0.72, w: 1.4, h: 0.25,
      fontSize: 8, fontFace: "Arial", color: "64748b",
    });
  });

  // L1 domains as rows with L2 tiles
  let yPos = 1.2;
  for (const l1 of roots) {
    // L1 header
    slide2.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: yPos, w: 9, h: 0.35,
      fill: { color: "f1f3f5" },
      rectRadius: 0.05,
    });
    slide2.addText(`${l1.name} (${l1.children.length})`, {
      x: 0.6, y: yPos, w: 8.8, h: 0.35,
      fontSize: 10, fontFace: "Arial", color: "1a1f2e", bold: true,
    });
    yPos += 0.4;

    // L2 tiles (4 per row)
    const cols = 4;
    const tileW = 2.15;
    const tileH = 0.55;
    const gap = 0.1;

    for (let i = 0; i < l1.children.length; i++) {
      const l2 = l1.children[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 0.5 + col * (tileW + gap);
      const y = yPos + row * (tileH + gap);
      const color = MATURITY_COLORS[l2.currentMaturity] ?? MATURITY_COLORS.NOT_ASSESSED;

      slide2.addShape(pptx.ShapeType.rect, {
        x, y, w: tileW, h: tileH,
        fill: { color },
        rectRadius: 0.05,
      });
      slide2.addText(l2.name, {
        x, y, w: tileW, h: tileH,
        fontSize: 8, fontFace: "Arial", color: "FFFFFF",
        align: "center", valign: "middle", bold: true,
      });
    }

    const l2Rows = Math.ceil(l1.children.length / cols);
    yPos += l2Rows * (tileH + gap) + 0.15;

    // Check if we need a new slide
    if (yPos > 6.5 && roots.indexOf(l1) < roots.length - 1) {
      yPos = 0.5;
      const newSlide = pptx.addSlide();
      slide2.addText("(continued)", { x: 0.5, y: 0.2, w: 3, h: 0.3, fontSize: 10, color: "94a3b8" });
    }
  }

  // ── Slide 3+: Per-L1 Detail slides
  for (const l1 of roots) {
    const detailSlide = pptx.addSlide();

    detailSlide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 0.15, h: "100%",
      fill: { color: MATURITY_COLORS[l1.currentMaturity] ?? "94a3b8" },
    });

    detailSlide.addText(l1.name, {
      x: 0.5, y: 0.2, w: 9, h: 0.5,
      fontSize: 20, fontFace: "Arial", color: "1a1f2e", bold: true,
    });

    if (l1.description) {
      detailSlide.addText(l1.description, {
        x: 0.5, y: 0.7, w: 9, h: 0.4,
        fontSize: 10, fontFace: "Arial", color: "64748b",
      });
    }

    // Table of L2 capabilities
    const tableRows: any[][] = [
      [
        { text: "Capability", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
        { text: "Current", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
        { text: "Target", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
        { text: "Importance", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
        { text: "Gap", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      ],
    ];

    for (const l2 of l1.children) {
      const matNum: Record<string, number> = {
        INITIAL: 1, DEVELOPING: 2, DEFINED: 3, MANAGED: 4, OPTIMIZING: 5, NOT_ASSESSED: 0,
      };
      const gap = (matNum[l2.targetMaturity] ?? 0) - (matNum[l2.currentMaturity] ?? 0);

      tableRows.push([
        { text: l2.name, options: { fontSize: 9, color: "1a1f2e" } },
        { text: MATURITY_LABELS[l2.currentMaturity] ?? "N/A", options: { fontSize: 9, color: MATURITY_COLORS[l2.currentMaturity] ?? "94a3b8" } },
        { text: MATURITY_LABELS[l2.targetMaturity] ?? "N/A", options: { fontSize: 9, color: "1a1f2e" } },
        { text: IMPORTANCE_LABELS[l2.strategicImportance] ?? "N/A", options: { fontSize: 9, color: "1a1f2e" } },
        { text: gap > 0 ? `+${gap}` : gap === 0 ? "—" : String(gap), options: { fontSize: 9, color: gap > 0 ? "ea580c" : "16a34a", bold: gap > 0 } },
      ]);
    }

    if (tableRows.length > 1) {
      detailSlide.addTable(tableRows, {
        x: 0.5, y: 1.2, w: 9,
        border: { type: "solid", color: "e9ecef", pt: 0.5 },
        colW: [3.5, 1.5, 1.5, 1.5, 1],
        rowH: 0.35,
        autoPage: true,
      });
    }
  }

  // Generate buffer
  const buffer = await pptx.write({ outputType: "nodebuffer" }) as Buffer;
  const uint8 = new Uint8Array(buffer);

  return new Response(uint8, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${(workspace.clientName || workspace.name).replace(/[^a-zA-Z0-9]/g, "_")}_Capability_Map.pptx"`,
    },
  });
}
