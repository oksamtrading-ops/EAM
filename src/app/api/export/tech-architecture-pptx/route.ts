import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import PptxGenJS from "pptxgenjs";
import { computeTechArchitectureFindings } from "@/server/services/techArchitectureFindings";

const LIFECYCLE_COLORS: Record<string, string> = {
  PREVIEW: "a855f7",
  CURRENT: "22c55e",
  MAINSTREAM: "3b82f6",
  EXTENDED_SUPPORT: "f59e0b",
  DEPRECATED: "f97316",
  END_OF_LIFE: "ef4444",
};

const SEVERITY_COLORS: Record<string, string> = {
  HIGH: "ef4444",
  MEDIUM: "f59e0b",
  LOW: "64748b",
};

const STANDARD_LEVEL_COLORS: Record<string, string> = {
  MANDATORY: "1d4ed8",
  RECOMMENDED: "22c55e",
  DEPRECATED: "f59e0b",
  PROHIBITED: "ef4444",
};

const EOL_BUCKETS = [
  { key: "past", label: "Past EOL", color: "ef4444" },
  { key: "lt30", label: "< 30 days", color: "f97316" },
  { key: "lt90", label: "30-90 days", color: "f59e0b" },
  { key: "lt180", label: "90-180 days", color: "eab308" },
  { key: "lt365", label: "180-365 days", color: "84cc16" },
  { key: "gte365", label: "1 year+", color: "22c55e" },
  { key: "unknown", label: "Unknown", color: "94a3b8" },
] as const;

type BucketKey = (typeof EOL_BUCKETS)[number]["key"];

function eolBucket(eol: Date | null | undefined): BucketKey {
  if (!eol) return "unknown";
  const days = Math.ceil((new Date(eol).getTime() - Date.now()) / 86400000);
  if (days < 0) return "past";
  if (days < 30) return "lt30";
  if (days < 90) return "lt90";
  if (days < 180) return "lt180";
  if (days < 365) return "lt365";
  return "gte365";
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  let body: { workspaceId?: string };
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

  const [
    vendors,
    products,
    versions,
    components,
    appsTotal,
    linkedAppsCount,
    standards,
    refArchs,
    findings,
  ] = await Promise.all([
    db.vendor.count({ where: { workspaceId, isActive: true } }),
    db.technologyProduct.findMany({
      where: { workspaceId, isActive: true },
      include: { vendor: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    db.technologyVersion.findMany({
      where: { workspaceId, isActive: true },
      include: {
        product: { select: { name: true } },
        _count: { select: { components: true } },
      },
    }),
    db.technologyComponent.count({ where: { workspaceId, isActive: true } }),
    db.application.count({ where: { workspaceId, isActive: true } }),
    db.application.count({
      where: { workspaceId, isActive: true, technologyComponents: { some: {} } },
    }),
    db.technologyStandard.findMany({
      where: { workspaceId, isActive: true },
      include: { product: { select: { name: true } } },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    }),
    db.referenceArchitecture.findMany({
      where: { workspaceId, isActive: true },
      include: {
        _count: { select: { components: true } },
        owner: { select: { name: true, email: true } },
      },
      orderBy: { name: "asc" },
    }),
    computeTechArchitectureFindings(db, workspaceId),
  ]);

  const coveragePct = appsTotal === 0 ? 0 : Math.round((linkedAppsCount / appsTotal) * 100);

  // Lifecycle counts
  const lifecycleCounts: Record<string, number> = {};
  for (const v of versions) {
    lifecycleCounts[v.lifecycleStatus] = (lifecycleCounts[v.lifecycleStatus] ?? 0) + 1;
  }

  // Severity counts
  const severityCounts = {
    HIGH: findings.filter((f) => f.severity === "HIGH").length,
    MEDIUM: findings.filter((f) => f.severity === "MEDIUM").length,
    LOW: findings.filter((f) => f.severity === "LOW").length,
  };

  // Build per-product lifecycle heatmap matrix (products with 2+ versions)
  type ProductRow = {
    productName: string;
    versionCount: number;
    buckets: Record<BucketKey, number>;
  };
  const productRows = new Map<string, ProductRow>();
  for (const v of versions) {
    const key = v.product.name;
    const row =
      productRows.get(key) ??
      ({
        productName: key,
        versionCount: 0,
        buckets: { past: 0, lt30: 0, lt90: 0, lt180: 0, lt365: 0, gte365: 0, unknown: 0 },
      } as ProductRow);
    row.versionCount += 1;
    row.buckets[eolBucket(v.endOfLifeDate)] += 1;
    productRows.set(key, row);
  }
  const heatmapRows = Array.from(productRows.values())
    .filter((r) => r.versionCount > 0)
    .sort((a, b) => {
      const aPast = a.buckets.past + a.buckets.lt30 + a.buckets.lt90;
      const bPast = b.buckets.past + b.buckets.lt30 + b.buckets.lt90;
      if (aPast !== bPast) return bPast - aPast;
      return b.versionCount - a.versionCount;
    })
    .slice(0, 14);

  const pptx = new PptxGenJS();
  pptx.author = "V2V";
  pptx.title = `${workspace.clientName || workspace.name} — Technology Architecture`;

  // ─── Slide 1: Title ─────────────────────────────────────
  const s1 = pptx.addSlide();
  s1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: "1a1f2e" } });
  s1.addText("Technology Architecture\nCatalog & Lifecycle Posture", {
    x: 0.8, y: 1.5, w: 8.4, h: 1.5,
    fontSize: 28, fontFace: "Arial", color: "FFFFFF", bold: true,
  });
  s1.addText(workspace.clientName || workspace.name, {
    x: 0.8, y: 3, w: 8.4, h: 0.5,
    fontSize: 16, fontFace: "Arial", color: "86BC25",
  });
  s1.addText(
    `${products.length} Products · ${versions.length} Versions · ${components} Components · ${coveragePct}% App Coverage · ${new Date().toLocaleDateString()}`,
    { x: 0.8, y: 3.6, w: 8.4, h: 0.4, fontSize: 10, fontFace: "Arial", color: "94a3b8" }
  );

  // ─── Slide 2: Portfolio Overview ────────────────────────
  const s2 = pptx.addSlide();
  s2.addText("Portfolio Overview", {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 20, fontFace: "Arial", color: "1a1f2e", bold: true,
  });

  const kpis: { label: string; value: number | string; accent: string }[] = [
    { label: "Vendors", value: vendors, accent: "1d4ed8" },
    { label: "Products", value: products.length, accent: "0ea5e9" },
    { label: "Versions", value: versions.length, accent: "14b8a6" },
    { label: "Components", value: components, accent: "8b5cf6" },
    { label: "App Coverage", value: `${coveragePct}%`, accent: "22c55e" },
    { label: "Findings", value: findings.length, accent: "ef4444" },
  ];
  kpis.forEach((k, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.5 + col * 3;
    const y = 0.9 + row * 1.1;
    s2.addShape(pptx.ShapeType.rect, {
      x, y, w: 2.85, h: 0.95,
      fill: { color: "FFFFFF" }, line: { color: "e5e7eb", width: 0.5 }, rectRadius: 0.05,
    });
    s2.addText(String(k.value), {
      x, y: y + 0.08, w: 2.85, h: 0.45,
      fontSize: 22, fontFace: "Arial", color: k.accent, bold: true, align: "center",
    });
    s2.addText(k.label, {
      x, y: y + 0.55, w: 2.85, h: 0.3,
      fontSize: 9, fontFace: "Arial", color: "64748b", align: "center",
    });
  });

  // Lifecycle bar
  s2.addText("Version lifecycle distribution", {
    x: 0.5, y: 3.2, w: 9, h: 0.3,
    fontSize: 11, fontFace: "Arial", color: "1a1f2e", bold: true,
  });
  let barX = 0.5;
  const totalForBar = versions.length || 1;
  for (const lc of ["PREVIEW", "CURRENT", "MAINSTREAM", "EXTENDED_SUPPORT", "DEPRECATED", "END_OF_LIFE"]) {
    const count = lifecycleCounts[lc] ?? 0;
    if (count === 0) continue;
    const w = Math.max(0.6, 9 * (count / totalForBar));
    s2.addShape(pptx.ShapeType.rect, {
      x: barX, y: 3.55, w, h: 0.5,
      fill: { color: LIFECYCLE_COLORS[lc]! }, rectRadius: 0.05,
    });
    s2.addText(`${lc.replace(/_/g, " ")}: ${count}`, {
      x: barX, y: 3.55, w, h: 0.5,
      fontSize: 9, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center", valign: "middle",
    });
    barX += w + 0.04;
  }

  // Top products by vendor
  const vendorCounts: Record<string, number> = {};
  for (const p of products) {
    vendorCounts[p.vendor.name] = (vendorCounts[p.vendor.name] ?? 0) + 1;
  }
  const topVendors = Object.entries(vendorCounts).sort(([, a], [, b]) => b - a).slice(0, 5);
  s2.addText("Top vendor concentration", {
    x: 0.5, y: 4.35, w: 9, h: 0.3,
    fontSize: 11, fontFace: "Arial", color: "1a1f2e", bold: true,
  });
  topVendors.forEach(([name, count], i) => {
    const maxCount = topVendors[0]?.[1] ?? 1;
    const w = 7 * (count / maxCount);
    const y = 4.7 + i * 0.35;
    s2.addText(name, {
      x: 0.5, y, w: 1.8, h: 0.3,
      fontSize: 9, fontFace: "Arial", color: "1a1f2e",
    });
    s2.addShape(pptx.ShapeType.rect, {
      x: 2.35, y: y + 0.05, w: Math.max(0.3, w), h: 0.2,
      fill: { color: "3b82f6" }, rectRadius: 0.03,
    });
    s2.addText(String(count), {
      x: 2.4 + Math.max(0.3, w), y, w: 0.5, h: 0.3,
      fontSize: 9, fontFace: "Arial", color: "1a1f2e", bold: true,
    });
  });

  // ─── Slide 3: Lifecycle Heatmap ─────────────────────────
  const s3 = pptx.addSlide();
  s3.addText("Lifecycle Heatmap — Versions by EOL Horizon", {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 20, fontFace: "Arial", color: "1a1f2e", bold: true,
  });
  s3.addText(
    `${heatmapRows.length} product${heatmapRows.length !== 1 ? "s" : ""} shown · rows ranked by near-term risk`,
    { x: 0.5, y: 0.7, w: 9, h: 0.3, fontSize: 10, fontFace: "Arial", color: "64748b" }
  );

  const heatTableRows: PptxGenJS.TableRow[] = [
    [
      { text: "Product", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      ...EOL_BUCKETS.map((b) => ({
        text: b.label,
        options: { bold: true, fontSize: 8, color: "FFFFFF", fill: { color: "1a1f2e" }, align: "center" as const },
      })),
      { text: "Total", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" }, align: "center" as const } },
    ],
  ];
  for (const r of heatmapRows) {
    heatTableRows.push([
      { text: r.productName, options: { fontSize: 9, bold: true } },
      ...EOL_BUCKETS.map((b) => {
        const count = r.buckets[b.key];
        return {
          text: count > 0 ? String(count) : "",
          options: {
            fontSize: 10,
            bold: count > 0,
            align: "center" as const,
            color: count > 0 ? "FFFFFF" : "94a3b8",
            fill: count > 0 ? { color: b.color } : { color: "f8fafc" },
          },
        };
      }),
      { text: String(r.versionCount), options: { fontSize: 9, align: "center", bold: true } },
    ]);
  }
  s3.addTable(heatTableRows, {
    x: 0.5, y: 1.1, w: 9,
    border: { type: "solid", color: "e9ecef", pt: 0.5 },
    colW: [2.1, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.75, 0.55],
    rowH: 0.3, autoPage: true,
  });

  // ─── Slide 4: Standards & Compliance ────────────────────
  const s4 = pptx.addSlide();
  s4.addText("Standards & Reference Architectures", {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 20, fontFace: "Arial", color: "1a1f2e", bold: true,
  });

  const standardsByLevel: Record<string, number> = {};
  for (const s of standards) {
    standardsByLevel[s.level] = (standardsByLevel[s.level] ?? 0) + 1;
  }
  (["MANDATORY", "RECOMMENDED", "DEPRECATED", "PROHIBITED"] as const).forEach((lv, i) => {
    const count = standardsByLevel[lv] ?? 0;
    const x = 0.5 + i * 2.25;
    s4.addShape(pptx.ShapeType.rect, {
      x, y: 0.9, w: 2.1, h: 0.95,
      fill: { color: "FFFFFF" }, line: { color: "e5e7eb", width: 0.5 }, rectRadius: 0.05,
    });
    s4.addText(String(count), {
      x, y: 0.95, w: 2.1, h: 0.45,
      fontSize: 22, fontFace: "Arial", color: STANDARD_LEVEL_COLORS[lv]!, bold: true, align: "center",
    });
    s4.addText(lv, {
      x, y: 1.45, w: 2.1, h: 0.3,
      fontSize: 9, fontFace: "Arial", color: "64748b", align: "center",
    });
  });

  // Top standards table
  s4.addText("Active standards", {
    x: 0.5, y: 2.1, w: 9, h: 0.3,
    fontSize: 11, fontFace: "Arial", color: "1a1f2e", bold: true,
  });
  const stdRows: PptxGenJS.TableRow[] = [
    [
      { text: "Standard", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "Level", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "Category", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "Product", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "Status", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
    ],
  ];
  for (const s of standards.slice(0, 10)) {
    stdRows.push([
      { text: s.name, options: { fontSize: 8, bold: true } },
      { text: s.level, options: { fontSize: 8, bold: true, color: STANDARD_LEVEL_COLORS[s.level] ?? "475569" } },
      { text: s.category.replace(/_/g, " "), options: { fontSize: 8 } },
      { text: s.product?.name ?? "—", options: { fontSize: 8, color: s.product ? "475569" : "94a3b8" } },
      { text: s.status, options: { fontSize: 8 } },
    ]);
  }
  s4.addTable(stdRows, {
    x: 0.5, y: 2.45, w: 9,
    border: { type: "solid", color: "e9ecef", pt: 0.5 },
    colW: [3, 1.3, 1.8, 1.9, 1], rowH: 0.28, autoPage: true,
  });

  // Reference architectures summary
  s4.addText(
    `Reference Architectures: ${refArchs.length} (${refArchs.filter((a) => a.status === "ACTIVE").length} active)`,
    { x: 0.5, y: 5.7, w: 9, h: 0.3, fontSize: 10, fontFace: "Arial", color: "64748b", italic: true }
  );

  // ─── Slide 5: Findings ──────────────────────────────────
  const s5 = pptx.addSlide();
  s5.addText("Architecture Findings", {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 20, fontFace: "Arial", color: "1a1f2e", bold: true,
  });
  s5.addText(
    `${findings.length} finding${findings.length !== 1 ? "s" : ""} detected`,
    { x: 0.5, y: 0.7, w: 9, h: 0.3, fontSize: 10, fontFace: "Arial", color: "64748b" }
  );

  (["HIGH", "MEDIUM", "LOW"] as const).forEach((sv, i) => {
    const x = 0.5 + i * 3;
    s5.addShape(pptx.ShapeType.rect, {
      x, y: 1.1, w: 2.85, h: 0.95,
      fill: { color: "FFFFFF" }, line: { color: "e5e7eb", width: 0.5 }, rectRadius: 0.05,
    });
    s5.addText(String(severityCounts[sv]), {
      x, y: 1.15, w: 2.85, h: 0.45,
      fontSize: 22, fontFace: "Arial", color: SEVERITY_COLORS[sv]!, bold: true, align: "center",
    });
    s5.addText(sv, {
      x, y: 1.65, w: 2.85, h: 0.3,
      fontSize: 9, fontFace: "Arial", color: "64748b", align: "center",
    });
  });

  // Top findings table
  const findingsTable: PptxGenJS.TableRow[] = [
    [
      { text: "Severity", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "Type", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "Entity", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "Description", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
    ],
  ];
  const orderedFindings = [...findings].sort((a, b) => {
    const score = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return score[b.severity] - score[a.severity];
  });
  for (const f of orderedFindings.slice(0, 12)) {
    findingsTable.push([
      { text: f.severity, options: { fontSize: 8, bold: true, color: SEVERITY_COLORS[f.severity] } },
      { text: f.kind.replace(/_/g, " "), options: { fontSize: 8 } },
      { text: f.entityName, options: { fontSize: 8, bold: true } },
      { text: f.description, options: { fontSize: 8, color: "475569" } },
    ]);
  }
  s5.addTable(findingsTable, {
    x: 0.5, y: 2.25, w: 9,
    border: { type: "solid", color: "e9ecef", pt: 0.5 },
    colW: [1, 1.8, 2.2, 4], rowH: 0.3, autoPage: true,
  });

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  const uint8 = new Uint8Array(buffer);

  return new Response(uint8, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="Technology_Architecture.pptx"`,
    },
  });
}
