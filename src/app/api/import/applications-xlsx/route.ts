import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as XLSX from "xlsx";
import { db } from "@/server/db";

const VALID_APP_TYPES = ["SAAS", "COTS", "CUSTOM", "PAAS", "OPEN_SOURCE", "LEGACY"] as const;
const VALID_DEPLOY = ["CLOUD_PUBLIC", "CLOUD_PRIVATE", "ON_PREMISE", "HYBRID", "SAAS_HOSTED", "UNKNOWN"] as const;
const VALID_LIFECYCLE = ["PLANNED", "ACTIVE", "PHASING_OUT", "RETIRED", "SUNSET"] as const;
const VALID_BV = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "BV_UNKNOWN"] as const;
const VALID_TH = ["EXCELLENT", "GOOD", "FAIR", "POOR", "TH_CRITICAL", "TH_UNKNOWN"] as const;
const VALID_RAT = ["TOLERATE", "INVEST", "MIGRATE", "ELIMINATE", "RAT_NOT_ASSESSED"] as const;
const VALID_COST_MODEL = ["LICENSE_PER_USER", "LICENSE_FLAT", "SUBSCRIPTION", "USAGE_BASED", "OPEN_SOURCE", "INTERNAL"] as const;
const VALID_FF = ["EXCELLENT", "GOOD", "ADEQUATE", "POOR", "UNFIT", "FF_UNKNOWN"] as const;
const VALID_DC = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "DC_UNKNOWN"] as const;

type ValidatedRow = {
  rowNum: number;
  data: Record<string, unknown>;
  errors: string[];
  isValid: boolean;
};

function validateEnum(val: string | undefined, allowed: readonly string[], fieldName: string): string | null {
  if (!val || val.trim() === "") return null;
  const upper = val.trim().toUpperCase();
  if (!(allowed as readonly string[]).includes(upper)) return `${fieldName}: invalid value "${val}"`;
  return null;
}

function parseRow(row: Record<string, unknown>, rowNum: number): ValidatedRow {
  const errors: string[] = [];
  const name = String(row["Name"] ?? "").trim();
  if (!name) errors.push("Name is required");

  // Validate enums
  const typeStr = String(row["Type"] ?? "").trim().toUpperCase() || undefined;
  const deployStr = String(row["Deployment Model"] ?? "").trim().toUpperCase() || undefined;
  const lifecycleStr = String(row["Lifecycle"] ?? "").trim().toUpperCase() || undefined;
  const bvStr = String(row["Business Value"] ?? "").trim().toUpperCase() || undefined;
  const thStr = String(row["Technical Health"] ?? "").trim().toUpperCase() || undefined;
  const ratStr = String(row["Rationalization"] ?? "").trim().toUpperCase() || undefined;
  const costModelStr = String(row["Cost Model"] ?? "").trim().toUpperCase() || undefined;
  const ffStr = String(row["Functional Fit"] ?? "").trim().toUpperCase() || undefined;
  const dcStr = String(row["Data Classification"] ?? "").trim().toUpperCase() || undefined;

  const enumErrors = [
    validateEnum(typeStr, VALID_APP_TYPES, "Type"),
    validateEnum(deployStr, VALID_DEPLOY, "Deployment Model"),
    validateEnum(lifecycleStr, VALID_LIFECYCLE, "Lifecycle"),
    validateEnum(bvStr, VALID_BV, "Business Value"),
    validateEnum(thStr, VALID_TH, "Technical Health"),
    validateEnum(ratStr, VALID_RAT, "Rationalization"),
    validateEnum(costModelStr, VALID_COST_MODEL, "Cost Model"),
    validateEnum(ffStr, VALID_FF, "Functional Fit"),
    validateEnum(dcStr, VALID_DC, "Data Classification"),
  ].filter(Boolean) as string[];
  errors.push(...enumErrors);

  // Parse cost
  const costRaw = row["Annual Cost"];
  let annualCostUsd: number | null = null;
  if (costRaw !== undefined && costRaw !== "" && costRaw !== null) {
    const parsed = parseFloat(String(costRaw).replace(/[,$]/g, ""));
    if (isNaN(parsed)) errors.push("Annual Cost: must be a number");
    else annualCostUsd = parsed;
  }

  // Parse licensed users
  const luRaw = row["Licensed Users"];
  let licensedUsers: number | null = null;
  if (luRaw !== undefined && luRaw !== "" && luRaw !== null) {
    const parsed = parseInt(String(luRaw));
    if (isNaN(parsed)) errors.push("Licensed Users: must be a number");
    else licensedUsers = parsed;
  }

  // Parse actual users
  const auRaw = row["Actual Users"];
  let actualUsers: number | null = null;
  if (auRaw !== undefined && auRaw !== "" && auRaw !== null) {
    const parsed = parseInt(String(auRaw));
    if (isNaN(parsed)) errors.push("Actual Users: must be a number");
    else actualUsers = parsed;
  }

  // Parse renewal date
  let costRenewalDate: Date | null = null;
  const renewalRaw = row["Cost Renewal Date"];
  if (renewalRaw && String(renewalRaw).trim()) {
    const d = new Date(String(renewalRaw));
    if (isNaN(d.getTime())) errors.push("Cost Renewal Date: invalid date format");
    else costRenewalDate = d;
  }

  return {
    rowNum,
    data: {
      name,
      description: String(row["Description"] ?? "").trim() || null,
      alias: String(row["Alias"] ?? "").trim() || null,
      vendor: String(row["Vendor"] ?? "").trim() || null,
      version: String(row["Version"] ?? "").trim() || null,
      applicationType: typeStr || "CUSTOM",
      deploymentModel: deployStr || "UNKNOWN",
      lifecycle: lifecycleStr || "ACTIVE",
      businessValue: bvStr || "BV_UNKNOWN",
      technicalHealth: thStr || "TH_UNKNOWN",
      rationalizationStatus: ratStr || "RAT_NOT_ASSESSED",
      annualCostUsd,
      costCurrency: String(row["Cost Currency"] ?? "USD").trim() || "USD",
      costModel: costModelStr || null,
      licensedUsers,
      costRenewalDate,
      costNotes: String(row["Cost Notes"] ?? "").trim() || null,
      businessOwnerName: String(row["Business Owner"] ?? "").trim() || null,
      itOwnerName: String(row["IT Owner"] ?? "").trim() || null,
      functionalFit: ffStr || "FF_UNKNOWN",
      dataClassification: dcStr || "DC_UNKNOWN",
      actualUsers,
    },
    errors,
    isValid: errors.length === 0,
  };
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const workspaceId = formData.get("workspaceId") as string | null;
  const action = (formData.get("action") as string) ?? "validate"; // "validate" | "import"

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!workspaceId) return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });

  // Verify workspace ownership
  const user = await db.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });
  const workspace = await db.workspace.findFirst({ where: { id: workspaceId, userId: user.id } });
  if (!workspace) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Parse the file
  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("application")) ?? wb.SheetNames[0];
  if (!sheetName) return NextResponse.json({ error: "No sheet found" }, { status: 400 });

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]!);
  if (rows.length === 0) return NextResponse.json({ error: "No data rows found" }, { status: 400 });

  // Validate all rows
  const validated = rows.map((row, i) => parseRow(row, i + 2)); // +2 for 1-indexed header row

  if (action === "validate") {
    // Return validation results for preview
    return NextResponse.json({
      totalRows: validated.length,
      validRows: validated.filter((r) => r.isValid).length,
      invalidRows: validated.filter((r) => !r.isValid).length,
      rows: validated.map((r) => ({
        rowNum: r.rowNum,
        name: r.data.name,
        isValid: r.isValid,
        errors: r.errors,
      })),
    });
  }

  // Import mode — only create valid rows
  const toCreate = validated.filter((r) => r.isValid);
  if (toCreate.length === 0) {
    return NextResponse.json({ error: "No valid rows to import" }, { status: 400 });
  }

  const created = await db.application.createMany({
    data: toCreate.map((r) => ({
      workspaceId,
      name: r.data.name as string,
      description: r.data.description as string | null,
      alias: r.data.alias as string | null,
      vendor: r.data.vendor as string | null,
      version: r.data.version as string | null,
      applicationType: r.data.applicationType as any,
      deploymentModel: r.data.deploymentModel as any,
      lifecycle: r.data.lifecycle as any,
      businessValue: r.data.businessValue as any,
      technicalHealth: r.data.technicalHealth as any,
      rationalizationStatus: r.data.rationalizationStatus as any,
      annualCostUsd: r.data.annualCostUsd as number | null,
      costCurrency: r.data.costCurrency as string,
      costModel: r.data.costModel as any,
      licensedUsers: r.data.licensedUsers as number | null,
      costRenewalDate: r.data.costRenewalDate as Date | null,
      costNotes: r.data.costNotes as string | null,
      businessOwnerName: r.data.businessOwnerName as string | null,
      itOwnerName: r.data.itOwnerName as string | null,
      functionalFit: r.data.functionalFit as any,
      dataClassification: r.data.dataClassification as any,
      actualUsers: r.data.actualUsers as number | null,
    })),
  });

  return NextResponse.json({
    imported: created.count,
    skipped: validated.length - toCreate.length,
    totalRows: validated.length,
  });
}
