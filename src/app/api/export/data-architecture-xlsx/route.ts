import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as XLSX from "xlsx";
import { db } from "@/server/db";

type ColDef = { header: string; key: string; required?: boolean; allowed?: string };

/** Domain columns — keyed to prisma fields on DataDomain (+ resolved owner names). */
const DOMAIN_COLUMNS: ColDef[] = [
  { header: "Name", key: "name", required: true },
  { header: "Description", key: "description" },
  { header: "Color", key: "color" },
  { header: "Owner", key: "ownerName" },
  { header: "Steward", key: "stewardName" },
];

/** Entity columns — keyed to prisma fields on DataEntity (+ resolved relations). */
const ENTITY_COLUMNS: ColDef[] = [
  { header: "Name", key: "name", required: true },
  { header: "Domain", key: "domainName", required: true },
  { header: "Description", key: "description" },
  { header: "Entity Type", key: "entityType", allowed: "MASTER, REFERENCE, TRANSACTIONAL, ANALYTICAL, METADATA" },
  { header: "Classification", key: "classification", allowed: "PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED, DC_UNKNOWN" },
  { header: "Regulatory Tags", key: "regulatoryTagsCsv", allowed: "Comma-separated: PII, PHI, PCI, GDPR, CCPA, SOX, HIPAA, FERPA" },
  { header: "Golden Source Application", key: "goldenSourceAppName" },
  { header: "Retention Days", key: "retentionDays" },
  { header: "Business Owner", key: "businessOwnerName" },
  { header: "Data Steward", key: "stewardName" },
  { header: "Technical Custodian", key: "custodianName" },
];

/** CRUD matrix columns. */
const USAGE_COLUMNS: ColDef[] = [
  { header: "Application", key: "appName", required: true },
  { header: "Data Entity", key: "entityName", required: true },
  { header: "Creates", key: "creates", allowed: "true / false" },
  { header: "Reads", key: "reads", allowed: "true / false" },
  { header: "Updates", key: "updates", allowed: "true / false" },
  { header: "Deletes", key: "deletes", allowed: "true / false" },
  { header: "Notes", key: "notes" },
];

/** Quality score columns. */
const QUALITY_COLUMNS: ColDef[] = [
  { header: "Data Entity", key: "entityName", required: true },
  { header: "Dimension", key: "dimension", allowed: "COMPLETENESS, ACCURACY, CONSISTENCY, TIMELINESS, UNIQUENESS, VALIDITY" },
  { header: "Score (0-100)", key: "score", required: true },
  { header: "As Of", key: "asOf" },
  { header: "Note", key: "note" },
];

/** Attribute columns — keyed to prisma fields on DataAttribute (+ resolved entity + FK target). */
const ATTRIBUTE_COLUMNS: ColDef[] = [
  { header: "Domain", key: "domainName", required: true },
  { header: "Entity", key: "entityName", required: true },
  { header: "Attribute", key: "name", required: true },
  { header: "Data Type", key: "dataType", required: true },
  { header: "Nullable", key: "isNullable", allowed: "true / false (default true)" },
  { header: "PK", key: "isPrimaryKey", allowed: "true / false" },
  { header: "FK", key: "isForeignKey", allowed: "true / false" },
  { header: "FK Target Entity", key: "fkTargetEntityName" },
  { header: "Classification", key: "classification", allowed: "PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED, DC_UNKNOWN" },
  { header: "Regulatory Tags", key: "regulatoryTagsCsv", allowed: "Comma-separated: PII, PHI, PCI, GDPR, CCPA, SOX, HIPAA, FERPA" },
  { header: "Description", key: "description" },
];

function sheetFromRows<T extends { header: string; key: string }>(
  columns: readonly T[],
  rows: Record<string, unknown>[]
) {
  const mapped = rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const col of columns) {
      let val = r[col.key];
      if (val instanceof Date) val = val.toISOString().split("T")[0];
      if (Array.isArray(val)) val = val.join(", ");
      out[col.header] = val ?? "";
    }
    return out;
  });
  const ws = XLSX.utils.json_to_sheet(mapped, { header: columns.map((c) => c.header) });
  ws["!cols"] = columns.map((c) => ({ wch: Math.max(c.header.length + 2, 18) }));
  return ws;
}

function templateSheet<T extends { header: string; key: string }>(
  columns: readonly T[],
  exampleRow: Record<string, string>
) {
  const headers = columns.map((c) => c.header);
  const row = columns.map((c) => exampleRow[c.key] ?? "");
  const ws = XLSX.utils.aoa_to_sheet([headers, row]);
  ws["!cols"] = columns.map((c) => ({ wch: Math.max(c.header.length + 2, 18) }));
  return ws;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const workspaceId = body.workspaceId as string;
  if (!workspaceId) return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });

  const mode = (body.mode as string) ?? "template"; // "template" | "data"

  const wb = XLSX.utils.book_new();

  if (mode === "data") {
    const [domains, entities, usages, scores, attributes] = await Promise.all([
      db.dataDomain.findMany({
        where: { workspaceId, isActive: true },
        include: {
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
          businessOwner: { select: { name: true, email: true } },
          steward: { select: { name: true, email: true } },
          custodian: { select: { name: true, email: true } },
        },
        orderBy: [{ domain: { name: "asc" } }, { name: "asc" }],
      }),
      db.appEntityUsage.findMany({
        where: { workspaceId },
        include: {
          app: { select: { name: true } },
          entity: { select: { name: true } },
        },
        orderBy: [{ app: { name: "asc" } }, { entity: { name: "asc" } }],
      }),
      db.dataQualityScore.findMany({
        where: { entity: { workspaceId } },
        include: { entity: { select: { name: true } } },
        orderBy: { asOf: "desc" },
      }),
      db.dataAttribute.findMany({
        where: { workspaceId, entity: { isActive: true } },
        include: {
          entity: {
            select: { name: true, domain: { select: { name: true } } },
          },
        },
        orderBy: [
          { entity: { domain: { name: "asc" } } },
          { entity: { name: "asc" } },
          { sortOrder: "asc" },
          { name: "asc" },
        ],
      }),
    ]);

    // Resolve FK target names (separate query — otherwise self-relation bloats the include)
    const fkTargetIds = Array.from(
      new Set(attributes.map((a) => a.fkTargetEntityId).filter((v): v is string => !!v))
    );
    const fkTargetEntities = fkTargetIds.length
      ? await db.dataEntity.findMany({
          where: { id: { in: fkTargetIds } },
          select: { id: true, name: true },
        })
      : [];
    const fkTargetNameById = new Map(fkTargetEntities.map((e) => [e.id, e.name]));

    XLSX.utils.book_append_sheet(
      wb,
      sheetFromRows(
        DOMAIN_COLUMNS,
        domains.map((d) => ({
          ...d,
          ownerName: d.owner?.name ?? d.owner?.email ?? "",
          stewardName: d.steward?.name ?? d.steward?.email ?? "",
        }))
      ),
      "Domains"
    );

    XLSX.utils.book_append_sheet(
      wb,
      sheetFromRows(
        ENTITY_COLUMNS,
        entities.map((e) => ({
          ...e,
          domainName: e.domain.name,
          goldenSourceAppName: e.goldenSourceApp?.name ?? "",
          regulatoryTagsCsv: e.regulatoryTags.join(", "),
          businessOwnerName: e.businessOwner?.name ?? e.businessOwner?.email ?? "",
          stewardName: e.steward?.name ?? e.steward?.email ?? "",
          custodianName: e.custodian?.name ?? e.custodian?.email ?? "",
        }))
      ),
      "Entities"
    );

    XLSX.utils.book_append_sheet(
      wb,
      sheetFromRows(
        USAGE_COLUMNS,
        usages.map((u) => ({
          appName: u.app.name,
          entityName: u.entity.name,
          creates: u.creates,
          reads: u.reads,
          updates: u.updates,
          deletes: u.deletes,
          notes: u.notes ?? "",
        }))
      ),
      "CRUD Matrix"
    );

    XLSX.utils.book_append_sheet(
      wb,
      sheetFromRows(
        QUALITY_COLUMNS,
        scores.map((s) => ({
          entityName: s.entity.name,
          dimension: s.dimension,
          score: s.score,
          asOf: s.asOf,
          note: s.note ?? "",
        }))
      ),
      "Quality Scores"
    );

    XLSX.utils.book_append_sheet(
      wb,
      sheetFromRows(
        ATTRIBUTE_COLUMNS,
        attributes.map((a) => ({
          domainName: a.entity.domain.name,
          entityName: a.entity.name,
          name: a.name,
          dataType: a.dataType,
          isNullable: a.isNullable,
          isPrimaryKey: a.isPrimaryKey,
          isForeignKey: a.isForeignKey,
          fkTargetEntityName: a.fkTargetEntityId
            ? fkTargetNameById.get(a.fkTargetEntityId) ?? ""
            : "",
          classification: a.classification,
          regulatoryTagsCsv: a.regulatoryTags.join(", "),
          description: a.description ?? "",
        }))
      ),
      "Attributes"
    );
  } else {
    // Template mode with example rows
    XLSX.utils.book_append_sheet(
      wb,
      templateSheet(DOMAIN_COLUMNS, {
        name: "Customer",
        description: "Customer and prospect data",
        color: "#0B5CD6",
        ownerName: "jane@example.com",
        stewardName: "steward@example.com",
      }),
      "Domains"
    );

    XLSX.utils.book_append_sheet(
      wb,
      templateSheet(ENTITY_COLUMNS, {
        name: "Customer Profile",
        domainName: "Customer",
        entityType: "MASTER",
        classification: "CONFIDENTIAL",
        regulatoryTagsCsv: "PII, GDPR",
        goldenSourceAppName: "Salesforce",
        retentionDays: "2555",
      }),
      "Entities"
    );

    XLSX.utils.book_append_sheet(
      wb,
      templateSheet(USAGE_COLUMNS, {
        appName: "Salesforce",
        entityName: "Customer Profile",
        creates: "true",
        reads: "true",
        updates: "true",
        deletes: "false",
      }),
      "CRUD Matrix"
    );

    XLSX.utils.book_append_sheet(
      wb,
      templateSheet(QUALITY_COLUMNS, {
        entityName: "Customer Profile",
        dimension: "COMPLETENESS",
        score: "87",
        asOf: "2026-04-15",
      }),
      "Quality Scores"
    );

    XLSX.utils.book_append_sheet(
      wb,
      templateSheet(ATTRIBUTE_COLUMNS, {
        domainName: "Customer",
        entityName: "Customer Profile",
        name: "email",
        dataType: "varchar(255)",
        isNullable: "false",
        isPrimaryKey: "false",
        isForeignKey: "false",
        fkTargetEntityName: "",
        classification: "CONFIDENTIAL",
        regulatoryTagsCsv: "PII, GDPR",
        description: "Primary contact email address",
      }),
      "Attributes"
    );

    // Instructions sheet
    const sectionHeader = (title: string) => [title];
    const instructions: (string | number)[][] = [
      ["Data Architecture Import Template — Instructions"],
      [""],
      ["1. Fill out each sheet with your data. Order matters: Domains first, then Entities (which reference domains), then CRUD Matrix + Attributes (which reference Entities)."],
      ["2. Applications must already exist in the workspace — import them separately first if needed."],
      ["3. Required columns are marked below. Delete example rows before importing."],
      ["4. For enum columns, use EXACTLY the values listed below."],
      ["5. Attributes are keyed by (Entity, Attribute) — re-importing with the same pair updates the existing field."],
      [""],
      sectionHeader("— Domains sheet —"),
      ["Column", "Required", "Allowed Values"],
      ...DOMAIN_COLUMNS.map((c) => [c.header, c.required ? "Yes" : "No", c.allowed ?? "Free text"]),
      [""],
      sectionHeader("— Entities sheet —"),
      ["Column", "Required", "Allowed Values"],
      ...ENTITY_COLUMNS.map((c) => [c.header, c.required ? "Yes" : "No", c.allowed ?? "Free text"]),
      [""],
      sectionHeader("— CRUD Matrix sheet —"),
      ["Column", "Required", "Allowed Values"],
      ...USAGE_COLUMNS.map((c) => [c.header, c.required ? "Yes" : "No", c.allowed ?? "Free text"]),
      [""],
      sectionHeader("— Quality Scores sheet —"),
      ["Column", "Required", "Allowed Values"],
      ...QUALITY_COLUMNS.map((c) => [c.header, c.required ? "Yes" : "No", c.allowed ?? "Free text"]),
      [""],
      sectionHeader("— Attributes sheet —"),
      ["Column", "Required", "Allowed Values"],
      ...ATTRIBUTE_COLUMNS.map((c) => [c.header, c.required ? "Yes" : "No", c.allowed ?? "Free text"]),
    ];
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    wsInstructions["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 72 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename =
    mode === "data" ? "Data_Architecture_Export.xlsx" : "Data_Architecture_Import_Template.xlsx";

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
