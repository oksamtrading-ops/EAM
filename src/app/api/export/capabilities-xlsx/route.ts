import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as XLSX from "xlsx";
import { db } from "@/server/db";

const COLUMNS = [
  { header: "Level", key: "level" },
  { header: "Name", key: "name" },
  { header: "Description", key: "description" },
  { header: "Parent", key: "parentName" },
  { header: "Value Stream", key: "valueStreamName" },
  { header: "Organization", key: "orgName" },
  { header: "Business Owner", key: "businessOwnerName" },
  { header: "IT Owner", key: "itOwnerName" },
  { header: "Current Maturity", key: "currentMaturity" },
  { header: "Target Maturity", key: "targetMaturity" },
  { header: "Strategic Importance", key: "strategicImportance" },
  { header: "App Count", key: "appCount" },
  { header: "Investment (Weighted)", key: "investmentUsd" },
  { header: "Tags", key: "tags" },
];

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const workspaceId = body.workspaceId as string;
  if (!workspaceId) return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });

  const format = (body.format as string) ?? "xlsx"; // "xlsx" | "csv"

  const capabilities = await db.businessCapability.findMany({
    where: { workspaceId, isActive: true },
    include: {
      parent: { select: { name: true } },
      organization: { select: { name: true } },
      valueStream: { select: { name: true } },
      businessOwner: { select: { name: true } },
      itOwner: { select: { name: true } },
      tags: { include: { tag: { select: { name: true } } } },
      applicationMappings: {
        include: {
          application: { select: { annualCostUsd: true } },
        },
      },
    },
    orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  const WEIGHTS: Record<string, number> = { PRIMARY: 1.0, SUPPORTING: 0.5, ENABLING: 0.25 };

  const rows = capabilities.map((cap) => {
    const investmentUsd = cap.applicationMappings.reduce((sum, m) => {
      const cost = m.application.annualCostUsd ? Number(m.application.annualCostUsd) : 0;
      const weight = WEIGHTS[m.relationshipType] ?? 1.0;
      return sum + cost * weight;
    }, 0);

    return {
      level: cap.level,
      name: cap.name,
      description: cap.description ?? "",
      parentName: cap.parent?.name ?? "",
      valueStreamName: cap.valueStream?.name ?? "",
      orgName: cap.organization?.name ?? "",
      businessOwnerName: cap.businessOwner?.name ?? "",
      itOwnerName: cap.itOwner?.name ?? "",
      currentMaturity: cap.currentMaturity,
      targetMaturity: cap.targetMaturity,
      strategicImportance: cap.strategicImportance,
      appCount: cap.applicationMappings.length,
      investmentUsd: investmentUsd > 0 ? investmentUsd.toFixed(2) : "",
      tags: cap.tags.map((t) => t.tag.name).join(", "),
    };
  });

  const wb = XLSX.utils.book_new();
  const wsData = [
    COLUMNS.map((c) => c.header),
    ...rows.map((row) => COLUMNS.map((c) => (row as any)[c.key] ?? "")),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-width
  ws["!cols"] = COLUMNS.map((_, i) => ({
    wch: Math.max(
      COLUMNS[i].header.length,
      ...rows.map((r) => String((r as any)[COLUMNS[i].key] ?? "").length).slice(0, 50)
    ) + 2,
  }));

  XLSX.utils.book_append_sheet(wb, ws, "Capabilities");

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="Capabilities_Export.csv"`,
      },
    });
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Capabilities_Export.xlsx"`,
    },
  });
}
