import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as XLSX from "xlsx";
import { db } from "@/server/db";

type ColDef = { header: string; key: string };

const VENDOR_COLUMNS: ColDef[] = [
  { header: "Name", key: "name" },
  { header: "Category", key: "category" },
  { header: "Status", key: "status" },
  { header: "Website", key: "website" },
  { header: "HQ Country", key: "headquartersCountry" },
  { header: "Annual Spend", key: "annualSpend" },
  { header: "Currency", key: "currency" },
  { header: "Relationship Owner", key: "relationshipOwnerName" },
  { header: "Contract Notes", key: "contractNotes" },
  { header: "Description", key: "description" },
];

const PRODUCT_COLUMNS: ColDef[] = [
  { header: "Name", key: "name" },
  { header: "Vendor", key: "vendorName" },
  { header: "Type", key: "type" },
  { header: "Category", key: "category" },
  { header: "License", key: "licenseType" },
  { header: "Open Source", key: "openSource" },
  { header: "Website", key: "website" },
  { header: "Description", key: "description" },
];

const VERSION_COLUMNS: ColDef[] = [
  { header: "Product", key: "productName" },
  { header: "Version", key: "version" },
  { header: "Lifecycle", key: "lifecycleStatus" },
  { header: "Release Date", key: "releaseDate" },
  { header: "End of Support", key: "endOfSupportDate" },
  { header: "End of Life", key: "endOfLifeDate" },
  { header: "Days to EOL", key: "daysToEol" },
  { header: "Components", key: "componentCount" },
  { header: "Notes", key: "notes" },
];

const COMPONENT_COLUMNS: ColDef[] = [
  { header: "Name", key: "name" },
  { header: "Product", key: "productName" },
  { header: "Vendor", key: "vendorName" },
  { header: "Version", key: "versionLabel" },
  { header: "Environment", key: "environment" },
  { header: "Hosting", key: "hostingModel" },
  { header: "Region", key: "region" },
  { header: "Owner", key: "ownerName" },
  { header: "Linked Applications", key: "applicationCount" },
  { header: "Notes", key: "notes" },
];

const APP_COMPONENT_COLUMNS: ColDef[] = [
  { header: "Application", key: "appName" },
  { header: "Component", key: "componentName" },
  { header: "Product", key: "productName" },
  { header: "Version", key: "versionLabel" },
  { header: "Layer", key: "layer" },
  { header: "Role", key: "role" },
  { header: "Criticality", key: "criticality" },
  { header: "Notes", key: "notes" },
];

const STANDARD_COLUMNS: ColDef[] = [
  { header: "Name", key: "name" },
  { header: "Category", key: "category" },
  { header: "Level", key: "level" },
  { header: "Status", key: "status" },
  { header: "Scoped Product", key: "productName" },
  { header: "Scoped Version", key: "versionLabel" },
  { header: "Owner", key: "ownerName" },
  { header: "Effective Date", key: "effectiveDate" },
  { header: "Review Date", key: "reviewDate" },
  { header: "Rationale", key: "rationale" },
  { header: "Description", key: "description" },
];

const REF_ARCH_COLUMNS: ColDef[] = [
  { header: "Name", key: "name" },
  { header: "Category", key: "category" },
  { header: "Status", key: "status" },
  { header: "Owner", key: "ownerName" },
  { header: "Components", key: "componentCount" },
  { header: "Diagram URL", key: "diagramUrl" },
  { header: "Description", key: "description" },
];

const REF_ARCH_COMPONENT_COLUMNS: ColDef[] = [
  { header: "Reference Architecture", key: "archName" },
  { header: "Layer", key: "layer" },
  { header: "Role", key: "role" },
  { header: "Product", key: "productName" },
  { header: "Vendor", key: "vendorName" },
  { header: "Version", key: "versionLabel" },
  { header: "Notes", key: "notes" },
];

function sheetFromRows(columns: ColDef[], rows: Record<string, unknown>[]) {
  const mapped = rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const col of columns) {
      let val = r[col.key];
      if (val instanceof Date) val = val.toISOString().split("T")[0];
      if (Array.isArray(val)) val = val.join(", ");
      if (val === null || val === undefined) val = "";
      if (typeof val === "boolean") val = val ? "true" : "false";
      out[col.header] = val;
    }
    return out;
  });
  const ws = XLSX.utils.json_to_sheet(mapped, { header: columns.map((c) => c.header) });
  ws["!cols"] = columns.map((c) => ({ wch: Math.max(c.header.length + 2, 18) }));
  return ws;
}

function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : null;
  if (!workspaceId) return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId },
    include: { user: true },
  });
  if (!workspace || workspace.user.clerkId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [vendors, products, versions, components, appLinks, standards, refArchs] =
    await Promise.all([
      db.vendor.findMany({
        where: { workspaceId, isActive: true },
        include: { relationshipOwner: { select: { name: true, email: true } } },
        orderBy: { name: "asc" },
      }),
      db.technologyProduct.findMany({
        where: { workspaceId, isActive: true },
        include: { vendor: { select: { name: true } } },
        orderBy: [{ vendor: { name: "asc" } }, { name: "asc" }],
      }),
      db.technologyVersion.findMany({
        where: { workspaceId, isActive: true },
        include: {
          product: { select: { name: true } },
          _count: { select: { components: true } },
        },
        orderBy: [{ product: { name: "asc" } }, { version: "asc" }],
      }),
      db.technologyComponent.findMany({
        where: { workspaceId, isActive: true },
        include: {
          product: {
            select: { name: true, vendor: { select: { name: true } } },
          },
          version: { select: { version: true } },
          owner: { select: { name: true, email: true } },
          _count: { select: { applications: true } },
        },
        orderBy: [{ name: "asc" }],
      }),
      db.applicationTechnology.findMany({
        where: { component: { workspaceId, isActive: true } },
        include: {
          application: { select: { name: true } },
          component: {
            select: {
              name: true,
              product: { select: { name: true } },
              version: { select: { version: true } },
            },
          },
        },
        orderBy: [{ application: { name: "asc" } }, { component: { name: "asc" } }],
      }),
      db.technologyStandard.findMany({
        where: { workspaceId, isActive: true },
        include: {
          product: { select: { name: true } },
          version: { select: { version: true } },
          owner: { select: { name: true, email: true } },
        },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      }),
      db.referenceArchitecture.findMany({
        where: { workspaceId, isActive: true },
        include: {
          owner: { select: { name: true, email: true } },
          components: {
            include: {
              product: {
                select: { name: true, vendor: { select: { name: true } } },
              },
              version: { select: { version: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      VENDOR_COLUMNS,
      vendors.map((v) => ({
        ...v,
        annualSpend: v.annualSpend ? v.annualSpend.toString() : "",
        relationshipOwnerName:
          v.relationshipOwner?.name ?? v.relationshipOwner?.email ?? "",
      }))
    ),
    "Vendors"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      PRODUCT_COLUMNS,
      products.map((p) => ({
        ...p,
        vendorName: p.vendor.name,
      }))
    ),
    "Products"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      VERSION_COLUMNS,
      versions.map((v) => {
        const days = daysUntil(v.endOfLifeDate);
        return {
          productName: v.product.name,
          version: v.version,
          lifecycleStatus: v.lifecycleStatus,
          releaseDate: v.releaseDate,
          endOfSupportDate: v.endOfSupportDate,
          endOfLifeDate: v.endOfLifeDate,
          daysToEol: days === null ? "" : days,
          componentCount: v._count.components,
          notes: v.notes,
        };
      })
    ),
    "Versions"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      COMPONENT_COLUMNS,
      components.map((c) => ({
        name: c.name,
        productName: c.product.name,
        vendorName: c.product.vendor.name,
        versionLabel: c.version?.version ?? "",
        environment: c.environment,
        hostingModel: c.hostingModel,
        region: c.region,
        ownerName: c.owner?.name ?? c.owner?.email ?? "",
        applicationCount: c._count.applications,
        notes: c.notes,
      }))
    ),
    "Components"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      APP_COMPONENT_COLUMNS,
      appLinks.map((l) => ({
        appName: l.application.name,
        componentName: l.component.name,
        productName: l.component.product.name,
        versionLabel: l.component.version?.version ?? "",
        layer: l.layer,
        role: l.role,
        criticality: l.criticality,
        notes: l.notes,
      }))
    ),
    "App ↔ Component"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      STANDARD_COLUMNS,
      standards.map((s) => ({
        name: s.name,
        category: s.category,
        level: s.level,
        status: s.status,
        productName: s.product?.name ?? "",
        versionLabel: s.version?.version ?? "",
        ownerName: s.owner?.name ?? s.owner?.email ?? "",
        effectiveDate: s.effectiveDate,
        reviewDate: s.reviewDate,
        rationale: s.rationale,
        description: s.description,
      }))
    ),
    "Standards"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      REF_ARCH_COLUMNS,
      refArchs.map((a) => ({
        name: a.name,
        category: a.category,
        status: a.status,
        ownerName: a.owner?.name ?? a.owner?.email ?? "",
        componentCount: a.components.length,
        diagramUrl: a.diagramUrl,
        description: a.description,
      }))
    ),
    "Reference Architectures"
  );

  const refArchComponents = refArchs.flatMap((a) =>
    a.components.map((c) => ({
      archName: a.name,
      layer: c.layer,
      role: c.role,
      productName: c.product.name,
      vendorName: c.product.vendor.name,
      versionLabel: c.version?.version ?? "",
      notes: c.notes,
    }))
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(REF_ARCH_COMPONENT_COLUMNS, refArchComponents),
    "Ref Arch Components"
  );

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Technology_Architecture_Export.xlsx"`,
    },
  });
}
