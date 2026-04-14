import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as XLSX from "xlsx";
import { db } from "@/server/db";

/** Column definitions for the export template / data export */
const COLUMNS = [
  { header: "Name", key: "name", required: true },
  { header: "Description", key: "description" },
  { header: "Alias", key: "alias" },
  { header: "Vendor", key: "vendor" },
  { header: "Version", key: "version" },
  { header: "Type", key: "applicationType", allowed: "SAAS, COTS, CUSTOM, PAAS, OPEN_SOURCE, LEGACY" },
  { header: "Deployment Model", key: "deploymentModel", allowed: "CLOUD_PUBLIC, CLOUD_PRIVATE, ON_PREMISE, HYBRID, SAAS_HOSTED, UNKNOWN" },
  { header: "Lifecycle", key: "lifecycle", allowed: "PLANNED, ACTIVE, PHASING_OUT, RETIRED, SUNSET" },
  { header: "Business Value", key: "businessValue", allowed: "CRITICAL, HIGH, MEDIUM, LOW, BV_UNKNOWN" },
  { header: "Technical Health", key: "technicalHealth", allowed: "EXCELLENT, GOOD, FAIR, POOR, TH_CRITICAL, TH_UNKNOWN" },
  { header: "Rationalization", key: "rationalizationStatus", allowed: "TOLERATE, INVEST, MIGRATE, ELIMINATE, RAT_NOT_ASSESSED" },
  { header: "Annual Cost", key: "annualCostUsd" },
  { header: "Cost Currency", key: "costCurrency" },
  { header: "Cost Model", key: "costModel", allowed: "LICENSE_PER_USER, LICENSE_FLAT, SUBSCRIPTION, USAGE_BASED, OPEN_SOURCE, INTERNAL" },
  { header: "Licensed Users", key: "licensedUsers" },
  { header: "Cost Renewal Date", key: "costRenewalDate" },
  { header: "Cost Notes", key: "costNotes" },
  { header: "Business Owner", key: "businessOwnerName" },
  { header: "IT Owner", key: "itOwnerName" },
];

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const workspaceId = body.workspaceId as string;
  if (!workspaceId) return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });

  const mode = (body.mode as string) ?? "template"; // "template" | "data"

  const wb = XLSX.utils.book_new();

  if (mode === "data") {
    // Export existing applications
    const apps = await db.application.findMany({
      where: { workspaceId, isActive: true },
      orderBy: { name: "asc" },
    });

    const rows = apps.map((app) => {
      const row: Record<string, unknown> = {};
      for (const col of COLUMNS) {
        let val = (app as Record<string, unknown>)[col.key];
        if (val instanceof Date) val = val.toISOString().split("T")[0];
        if (typeof val === "object" && val !== null) val = String(val);
        row[col.header] = val ?? "";
      }
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS.map((c) => c.header) });

    // Set column widths
    ws["!cols"] = COLUMNS.map((c) => ({ wch: Math.max(c.header.length + 2, 18) }));

    XLSX.utils.book_append_sheet(wb, ws, "Applications");
  } else {
    // Template with headers, instructions, and example row
    const headers = COLUMNS.map((c) => c.header);
    const exampleRow: string[] = COLUMNS.map((c) => {
      if (c.key === "name") return "Example App";
      if (c.key === "applicationType") return "SAAS";
      if (c.key === "lifecycle") return "ACTIVE";
      if (c.key === "annualCostUsd") return "12000";
      if (c.key === "costCurrency") return "USD";
      if (c.key === "costModel") return "SUBSCRIPTION";
      return "";
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);

    // Set column widths
    ws["!cols"] = COLUMNS.map((c) => ({ wch: Math.max(c.header.length + 2, 18) }));

    XLSX.utils.book_append_sheet(wb, ws, "Applications");

    // Instructions sheet
    const instructions = [
      ["Application Import Template — Instructions"],
      [""],
      ["1. Fill out the 'Applications' sheet with your application data."],
      ["2. The 'Name' column is required. All other columns are optional."],
      ["3. For columns with allowed values, use EXACTLY the values listed below."],
      ["4. Dates should be in YYYY-MM-DD format."],
      ["5. Annual Cost should be a number (no currency symbols)."],
      ["6. Delete the example row before importing."],
      [""],
      ["Column", "Required", "Allowed Values"],
      ...COLUMNS.map((c) => [c.header, c.required ? "Yes" : "No", c.allowed ?? "Free text"]),
    ];
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    wsInstructions["!cols"] = [{ wch: 25 }, { wch: 10 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = mode === "data" ? "Applications_Export.xlsx" : "Applications_Import_Template.xlsx";

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
