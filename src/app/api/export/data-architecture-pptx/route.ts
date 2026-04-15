import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import PptxGenJS from "pptxgenjs";
import { computeDataFindings, type DataFindingKind } from "@/server/services/dataFindings";

const CLASSIFICATION_COLORS: Record<string, string> = {
  PUBLIC: "22c55e",
  INTERNAL: "3b82f6",
  CONFIDENTIAL: "f59e0b",
  RESTRICTED: "ef4444",
  DC_UNKNOWN: "94a3b8",
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  PUBLIC: "Public",
  INTERNAL: "Internal",
  CONFIDENTIAL: "Confidential",
  RESTRICTED: "Restricted",
  DC_UNKNOWN: "Unclassified",
};

const FINDING_LABELS: Record<DataFindingKind, string> = {
  UNCLASSIFIED: "Unclassified entity",
  NO_STEWARD: "No data steward",
  NO_OWNER: "No business owner",
  NO_CUSTODIAN: "No technical custodian",
  NO_GOLDEN: "No golden source",
  SENSITIVE_NO_STEWARD: "Sensitive without steward",
  ATTRIBUTE_SENSITIVE_NO_CLASSIFICATION: "Sensitive attribute unclassified",
  ENTITY_NO_PRIMARY_KEY: "No primary key defined",
};

const FINDING_SEVERITY: Record<DataFindingKind, "HIGH" | "MEDIUM" | "LOW"> = {
  SENSITIVE_NO_STEWARD: "HIGH",
  NO_GOLDEN: "HIGH",
  NO_OWNER: "MEDIUM",
  NO_STEWARD: "MEDIUM",
  NO_CUSTODIAN: "LOW",
  UNCLASSIFIED: "MEDIUM",
  ATTRIBUTE_SENSITIVE_NO_CLASSIFICATION: "HIGH",
  ENTITY_NO_PRIMARY_KEY: "LOW",
};

const SEVERITY_COLORS: Record<string, string> = {
  HIGH: "ef4444",
  MEDIUM: "f59e0b",
  LOW: "64748b",
};

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

  const [domains, entities, findings] = await Promise.all([
    db.dataDomain.findMany({
      where: { workspaceId, isActive: true },
      include: {
        _count: { select: { entities: true } },
        owner: { select: { name: true, email: true } },
        steward: { select: { name: true, email: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.dataEntity.findMany({
      where: { workspaceId, isActive: true },
      include: {
        domain: { select: { name: true } },
        goldenSourceApp: { select: { name: true } },
        steward: { select: { name: true, email: true } },
      },
      orderBy: [{ classification: "desc" }, { name: "asc" }],
    }),
    computeDataFindings(db, workspaceId),
  ]);

  const totalEntities = entities.length;
  const sensitive = entities.filter(
    (e) => e.classification === "CONFIDENTIAL" || e.classification === "RESTRICTED"
  ).length;
  const unclassified = entities.filter((e) => e.classification === "DC_UNKNOWN").length;
  const regulated = entities.filter((e) => e.regulatoryTags.length > 0).length;
  const withoutSteward = entities.filter((e) => !e.stewardId).length;

  const classCounts: Record<string, number> = {};
  for (const e of entities) {
    classCounts[e.classification] = (classCounts[e.classification] ?? 0) + 1;
  }

  const findingCounts = new Map<DataFindingKind, number>();
  for (const f of findings) {
    findingCounts.set(f.kind, (findingCounts.get(f.kind) ?? 0) + 1);
  }

  const pptx = new PptxGenJS();
  pptx.author = "V2V";
  pptx.title = `${workspace.clientName || workspace.name} — Data Architecture`;

  // ─── Slide 1: Title ─────────────────────────────────────────────
  const s1 = pptx.addSlide();
  s1.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: "100%", fill: { color: "1a1f2e" },
  });
  s1.addText("Data Architecture\nPortfolio & Governance", {
    x: 0.8, y: 1.5, w: 8.4, h: 1.5,
    fontSize: 28, fontFace: "Arial", color: "FFFFFF", bold: true,
  });
  s1.addText(workspace.clientName || workspace.name, {
    x: 0.8, y: 3, w: 8.4, h: 0.5,
    fontSize: 16, fontFace: "Arial", color: "86BC25",
  });
  s1.addText(
    `${totalEntities} Entities | ${domains.length} Domains | ${sensitive} Sensitive | ${new Date().toLocaleDateString()}`,
    { x: 0.8, y: 3.6, w: 8.4, h: 0.4, fontSize: 10, fontFace: "Arial", color: "94a3b8" }
  );

  // ─── Slide 2: Domain Portfolio ──────────────────────────────────
  const s2 = pptx.addSlide();
  s2.addText("Domain Portfolio", {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 20, fontFace: "Arial", color: "1a1f2e", bold: true,
  });
  s2.addText(
    `${domains.length} domain${domains.length !== 1 ? "s" : ""} spanning ${totalEntities} data entities`,
    { x: 0.5, y: 0.7, w: 9, h: 0.3, fontSize: 10, fontFace: "Arial", color: "64748b" }
  );

  // Domain cards — up to 12 in a 4×3 grid, otherwise fall back to table
  if (domains.length <= 12) {
    const cols = 4;
    const cardW = 2.1;
    const cardH = 1.1;
    const gap = 0.15;
    domains.slice(0, 12).forEach((d, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 0.5 + col * (cardW + gap);
      const y = 1.2 + row * (cardH + gap);
      const color = (d.color ?? "#0B5CD6").replace("#", "");
      s2.addShape(pptx.ShapeType.rect, {
        x, y, w: cardW, h: cardH,
        fill: { color: "FFFFFF" },
        line: { color: "e5e7eb", width: 0.5 },
        rectRadius: 0.05,
      });
      s2.addShape(pptx.ShapeType.rect, {
        x, y, w: 0.08, h: cardH,
        fill: { color },
      });
      s2.addText(d.name, {
        x: x + 0.2, y: y + 0.1, w: cardW - 0.3, h: 0.3,
        fontSize: 11, fontFace: "Arial", bold: true, color: "1a1f2e",
      });
      s2.addText(`${d._count.entities} entit${d._count.entities === 1 ? "y" : "ies"}`, {
        x: x + 0.2, y: y + 0.4, w: cardW - 0.3, h: 0.25,
        fontSize: 9, fontFace: "Arial", color: "64748b",
      });
      const stewardName = d.steward?.name ?? d.steward?.email ?? "No steward";
      s2.addText(stewardName, {
        x: x + 0.2, y: y + 0.7, w: cardW - 0.3, h: 0.25,
        fontSize: 8, fontFace: "Arial",
        color: d.steward ? "475569" : "dc2626",
        italic: !d.steward,
      });
    });
  } else {
    const rows: PptxGenJS.TableRow[] = [
      [
        { text: "Domain", options: { bold: true, fontSize: 10, color: "FFFFFF", fill: { color: "1a1f2e" } } },
        { text: "Entities", options: { bold: true, fontSize: 10, color: "FFFFFF", fill: { color: "1a1f2e" } } },
        { text: "Steward", options: { bold: true, fontSize: 10, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      ],
    ];
    for (const d of domains) {
      rows.push([
        { text: d.name, options: { fontSize: 9, bold: true } },
        { text: String(d._count.entities), options: { fontSize: 9, align: "center" } },
        {
          text: d.steward?.name ?? d.steward?.email ?? "—",
          options: { fontSize: 9, color: d.steward ? "475569" : "dc2626" },
        },
      ]);
    }
    s2.addTable(rows, {
      x: 0.5, y: 1.2, w: 9,
      border: { type: "solid", color: "e9ecef", pt: 0.5 },
      colW: [4, 1.5, 3.5], rowH: 0.3, autoPage: true,
    });
  }

  // ─── Slide 3: Classification & Top Entities ─────────────────────
  const s3 = pptx.addSlide();
  s3.addText("Classification Breakdown", {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 20, fontFace: "Arial", color: "1a1f2e", bold: true,
  });

  // Classification bar row
  let x = 0.5;
  const totalForBars = totalEntities || 1;
  for (const cls of ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "DC_UNKNOWN"]) {
    const count = classCounts[cls] ?? 0;
    const pct = count / totalForBars;
    const w = Math.max(0.8, 8.5 * pct);
    if (count === 0) continue;
    const color = CLASSIFICATION_COLORS[cls]!;
    s3.addShape(pptx.ShapeType.rect, {
      x, y: 0.9, w, h: 0.5, fill: { color }, rectRadius: 0.05,
    });
    s3.addText(`${CLASSIFICATION_LABELS[cls]}: ${count}`, {
      x, y: 0.9, w, h: 0.5,
      fontSize: 10, fontFace: "Arial", color: "FFFFFF", bold: true,
      align: "center", valign: "middle",
    });
    x += w + 0.05;
  }

  // Top entities table
  s3.addText(
    `Top entities (${Math.min(entities.length, 15)} of ${totalEntities})`,
    { x: 0.5, y: 1.6, w: 9, h: 0.3, fontSize: 11, fontFace: "Arial", color: "64748b", bold: true }
  );

  const entityRows: PptxGenJS.TableRow[] = [
    [
      { text: "Entity", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "Domain", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "Classification", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "Tags", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "Golden Source", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "Steward", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
    ],
  ];

  for (const e of entities.slice(0, 15)) {
    const classColor = CLASSIFICATION_COLORS[e.classification] ?? "94a3b8";
    entityRows.push([
      { text: e.name, options: { fontSize: 8, bold: true } },
      { text: e.domain.name, options: { fontSize: 8 } },
      {
        text: CLASSIFICATION_LABELS[e.classification] ?? e.classification,
        options: { fontSize: 8, bold: true, color: classColor },
      },
      {
        text: e.regulatoryTags.length > 0 ? e.regulatoryTags.join(", ") : "—",
        options: { fontSize: 8, color: e.regulatoryTags.length > 0 ? "b45309" : "94a3b8" },
      },
      {
        text: e.goldenSourceApp?.name ?? "—",
        options: { fontSize: 8, color: e.goldenSourceApp ? "475569" : "dc2626" },
      },
      {
        text: e.steward?.name ?? e.steward?.email ?? "—",
        options: { fontSize: 8, color: e.steward ? "475569" : "dc2626" },
      },
    ]);
  }

  s3.addTable(entityRows, {
    x: 0.5, y: 2, w: 9,
    border: { type: "solid", color: "e9ecef", pt: 0.5 },
    colW: [2, 1.4, 1.4, 1.3, 1.6, 1.3], rowH: 0.28, autoPage: true,
  });

  // ─── Slide 4: Governance & Regulatory Posture ───────────────────
  const s4 = pptx.addSlide();
  s4.addText("Governance & Regulatory Posture", {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 20, fontFace: "Arial", color: "1a1f2e", bold: true,
  });

  // Top-line stats row
  const stats: { label: string; value: number; accent: string }[] = [
    { label: "Regulated Entities", value: regulated, accent: "b45309" },
    { label: "Sensitive", value: sensitive, accent: "ef4444" },
    { label: "Unclassified", value: unclassified, accent: "64748b" },
    { label: "Without Steward", value: withoutSteward, accent: "f59e0b" },
  ];
  stats.forEach((s, i) => {
    const x = 0.5 + i * 2.25;
    s4.addShape(pptx.ShapeType.rect, {
      x, y: 0.9, w: 2.1, h: 1,
      fill: { color: "FFFFFF" },
      line: { color: "e5e7eb", width: 0.5 },
      rectRadius: 0.05,
    });
    s4.addText(String(s.value), {
      x, y: 0.95, w: 2.1, h: 0.5,
      fontSize: 24, fontFace: "Arial", color: s.accent,
      bold: true, align: "center",
    });
    s4.addText(s.label, {
      x, y: 1.5, w: 2.1, h: 0.3,
      fontSize: 9, fontFace: "Arial", color: "64748b",
      align: "center",
    });
  });

  // Findings table
  s4.addText(
    `${findings.length} governance finding${findings.length !== 1 ? "s" : ""} detected`,
    { x: 0.5, y: 2.1, w: 9, h: 0.3, fontSize: 11, fontFace: "Arial", color: "1a1f2e", bold: true }
  );

  const findingRows: PptxGenJS.TableRow[] = [
    [
      { text: "Severity", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "Finding", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
      { text: "Count", options: { bold: true, fontSize: 9, color: "FFFFFF", fill: { color: "1a1f2e" } } },
    ],
  ];

  const orderedKinds: DataFindingKind[] = [
    "SENSITIVE_NO_STEWARD",
    "NO_GOLDEN",
    "NO_OWNER",
    "NO_STEWARD",
    "UNCLASSIFIED",
    "NO_CUSTODIAN",
  ];
  for (const kind of orderedKinds) {
    const count = findingCounts.get(kind) ?? 0;
    if (count === 0) continue;
    const severity = FINDING_SEVERITY[kind];
    findingRows.push([
      {
        text: severity,
        options: { fontSize: 9, bold: true, color: SEVERITY_COLORS[severity]!, align: "center" },
      },
      { text: FINDING_LABELS[kind], options: { fontSize: 9 } },
      { text: String(count), options: { fontSize: 9, align: "center" } },
    ]);
  }

  if (findingRows.length === 1) {
    // No findings — add an all-clear row
    findingRows.push([
      { text: "—", options: { fontSize: 9, color: "22c55e", bold: true, align: "center" } },
      { text: "No governance gaps detected", options: { fontSize: 9, color: "22c55e", bold: true } },
      { text: "0", options: { fontSize: 9, align: "center" } },
    ]);
  }

  s4.addTable(findingRows, {
    x: 0.5, y: 2.5, w: 9,
    border: { type: "solid", color: "e9ecef", pt: 0.5 },
    colW: [1.2, 6.3, 1.5], rowH: 0.35,
  });

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  const uint8 = new Uint8Array(buffer);

  return new Response(uint8, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="Data_Architecture.pptx"`,
    },
  });
}
