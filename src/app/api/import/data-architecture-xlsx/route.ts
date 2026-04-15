import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as XLSX from "xlsx";
import { db } from "@/server/db";

const VALID_ENTITY_TYPES = ["MASTER", "REFERENCE", "TRANSACTIONAL", "ANALYTICAL", "METADATA"] as const;
const VALID_CLASSIFICATIONS = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "DC_UNKNOWN"] as const;
const VALID_REG_TAGS = ["PII", "PHI", "PCI", "GDPR", "CCPA", "SOX", "HIPAA", "FERPA"] as const;
const VALID_DQ_DIMENSIONS = [
  "COMPLETENESS", "ACCURACY", "CONSISTENCY", "TIMELINESS", "UNIQUENESS", "VALIDITY",
] as const;

type RowError = { sheet: string; rowNum: number; name: string; errors: string[] };

function parseBool(val: unknown): boolean {
  if (val === true || val === 1) return true;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "true" || s === "yes" || s === "y" || s === "1" || s === "x";
  }
  return false;
}

function toStr(val: unknown): string {
  return String(val ?? "").trim();
}

function findSheet(wb: XLSX.WorkBook, match: string): XLSX.WorkSheet | null {
  const name = wb.SheetNames.find((n) => n.toLowerCase().includes(match.toLowerCase()));
  return name ? wb.Sheets[name]! : null;
}

function readRows(sheet: XLSX.WorkSheet | null): Record<string, unknown>[] {
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const workspaceId = formData.get("workspaceId") as string | null;
  const action = (formData.get("action") as string) ?? "validate";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!workspaceId) return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });

  // Authorize workspace access
  const user = await db.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });
  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, userId: user.id },
  });
  if (!workspace) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Parse workbook
  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });

  const domainRows = readRows(findSheet(wb, "domain"));
  const entityRows = readRows(findSheet(wb, "entit"));
  const usageRows = readRows(findSheet(wb, "crud") ?? findSheet(wb, "matrix") ?? findSheet(wb, "usage"));
  const qualityRows = readRows(findSheet(wb, "quality"));

  if (
    domainRows.length === 0 &&
    entityRows.length === 0 &&
    usageRows.length === 0 &&
    qualityRows.length === 0
  ) {
    return NextResponse.json({ error: "No data rows found in any sheet" }, { status: 400 });
  }

  // Preload existing workspace lookup tables (by lowercase name / lowercase email)
  const [existingDomains, existingEntities, existingApps, workspaceUsers] = await Promise.all([
    db.dataDomain.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    }),
    db.dataEntity.findMany({
      where: { workspaceId },
      select: { id: true, name: true, domainId: true },
    }),
    db.application.findMany({
      where: { workspaceId, isActive: true },
      select: { id: true, name: true },
    }),
    db.user.findMany({ select: { id: true, email: true, name: true } }),
  ]);

  const domainByName = new Map(existingDomains.map((d) => [d.name.toLowerCase(), d]));
  const entityByName = new Map(existingEntities.map((e) => [e.name.toLowerCase(), e]));
  const appByName = new Map(existingApps.map((a) => [a.name.toLowerCase(), a]));
  const userByEmail = new Map(workspaceUsers.map((u) => [u.email.toLowerCase(), u]));
  const userByName = new Map(
    workspaceUsers.filter((u) => u.name).map((u) => [u.name!.toLowerCase(), u])
  );

  function resolveUserId(raw: unknown): string | null {
    const s = toStr(raw).toLowerCase();
    if (!s) return null;
    return userByEmail.get(s)?.id ?? userByName.get(s)?.id ?? null;
  }

  // Collect validated rows per sheet
  type DomainRecord = {
    rowNum: number;
    name: string;
    description: string | null;
    color: string | null;
    ownerId: string | null;
    stewardId: string | null;
  };
  type EntityRecord = {
    rowNum: number;
    name: string;
    domainName: string;
    description: string | null;
    entityType: (typeof VALID_ENTITY_TYPES)[number];
    classification: (typeof VALID_CLASSIFICATIONS)[number];
    regulatoryTags: (typeof VALID_REG_TAGS)[number][];
    goldenSourceAppName: string;
    retentionDays: number | null;
    businessOwnerId: string | null;
    stewardId: string | null;
    custodianId: string | null;
  };
  type UsageRecord = {
    rowNum: number;
    appName: string;
    entityName: string;
    creates: boolean;
    reads: boolean;
    updates: boolean;
    deletes: boolean;
    notes: string | null;
  };
  type QualityRecord = {
    rowNum: number;
    entityName: string;
    dimension: (typeof VALID_DQ_DIMENSIONS)[number];
    score: number;
    note: string | null;
  };

  const domainsValid: DomainRecord[] = [];
  const entitiesValid: EntityRecord[] = [];
  const usagesValid: UsageRecord[] = [];
  const qualityValid: QualityRecord[] = [];
  const rowErrors: RowError[] = [];

  // Domains
  domainRows.forEach((row, i) => {
    const rowNum = i + 2;
    const name = toStr(row["Name"]);
    const errors: string[] = [];
    if (!name) errors.push("Name is required");
    if (errors.length > 0) {
      rowErrors.push({ sheet: "Domains", rowNum, name, errors });
      return;
    }
    domainsValid.push({
      rowNum,
      name,
      description: toStr(row["Description"]) || null,
      color: toStr(row["Color"]) || null,
      ownerId: resolveUserId(row["Owner"]),
      stewardId: resolveUserId(row["Steward"]),
    });
  });

  // Entities
  entityRows.forEach((row, i) => {
    const rowNum = i + 2;
    const name = toStr(row["Name"]);
    const domainName = toStr(row["Domain"]);
    const errors: string[] = [];
    if (!name) errors.push("Name is required");
    if (!domainName) errors.push("Domain is required");

    const entityTypeRaw = toStr(row["Entity Type"]).toUpperCase();
    const entityType = (entityTypeRaw || "TRANSACTIONAL") as (typeof VALID_ENTITY_TYPES)[number];
    if (entityTypeRaw && !VALID_ENTITY_TYPES.includes(entityType)) {
      errors.push(`Entity Type: invalid value "${entityTypeRaw}"`);
    }

    const classificationRaw = toStr(row["Classification"]).toUpperCase();
    const classification = (classificationRaw || "DC_UNKNOWN") as (typeof VALID_CLASSIFICATIONS)[number];
    if (classificationRaw && !VALID_CLASSIFICATIONS.includes(classification)) {
      errors.push(`Classification: invalid value "${classificationRaw}"`);
    }

    const regTagsRaw = toStr(row["Regulatory Tags"]);
    const regulatoryTags: (typeof VALID_REG_TAGS)[number][] = [];
    if (regTagsRaw) {
      const parts = regTagsRaw.split(/[,;]/).map((s) => s.trim().toUpperCase()).filter(Boolean);
      for (const p of parts) {
        if (VALID_REG_TAGS.includes(p as (typeof VALID_REG_TAGS)[number])) {
          regulatoryTags.push(p as (typeof VALID_REG_TAGS)[number]);
        } else {
          errors.push(`Regulatory Tag: invalid value "${p}"`);
        }
      }
    }

    let retentionDays: number | null = null;
    const retentionRaw = row["Retention Days"];
    if (retentionRaw !== undefined && toStr(retentionRaw) !== "") {
      const n = parseInt(String(retentionRaw), 10);
      if (isNaN(n) || n <= 0) errors.push("Retention Days: must be a positive integer");
      else retentionDays = n;
    }

    // Cross-reference domain: must exist after domain upsert OR already in DB OR in the import batch
    if (domainName) {
      const inDb = domainByName.has(domainName.toLowerCase());
      const inBatch = domainsValid.some(
        (d) => d.name.toLowerCase() === domainName.toLowerCase()
      );
      if (!inDb && !inBatch) {
        errors.push(`Domain "${domainName}" not found (add it to the Domains sheet or create it first)`);
      }
    }

    if (errors.length > 0) {
      rowErrors.push({ sheet: "Entities", rowNum, name, errors });
      return;
    }

    entitiesValid.push({
      rowNum,
      name,
      domainName,
      description: toStr(row["Description"]) || null,
      entityType,
      classification,
      regulatoryTags,
      goldenSourceAppName: toStr(row["Golden Source Application"]),
      retentionDays,
      businessOwnerId: resolveUserId(row["Business Owner"]),
      stewardId: resolveUserId(row["Data Steward"]),
      custodianId: resolveUserId(row["Technical Custodian"]),
    });
  });

  // CRUD Matrix
  usageRows.forEach((row, i) => {
    const rowNum = i + 2;
    const appName = toStr(row["Application"]);
    const entityName = toStr(row["Data Entity"]);
    const errors: string[] = [];
    if (!appName) errors.push("Application is required");
    if (!entityName) errors.push("Data Entity is required");

    if (appName && !appByName.has(appName.toLowerCase())) {
      errors.push(`Application "${appName}" not found (create it first)`);
    }
    if (entityName) {
      const inDb = entityByName.has(entityName.toLowerCase());
      const inBatch = entitiesValid.some((e) => e.name.toLowerCase() === entityName.toLowerCase());
      if (!inDb && !inBatch) {
        errors.push(`Data Entity "${entityName}" not found (add it to the Entities sheet)`);
      }
    }

    if (errors.length > 0) {
      rowErrors.push({ sheet: "CRUD Matrix", rowNum, name: `${appName} × ${entityName}`, errors });
      return;
    }

    usagesValid.push({
      rowNum,
      appName,
      entityName,
      creates: parseBool(row["Creates"]),
      reads: parseBool(row["Reads"]),
      updates: parseBool(row["Updates"]),
      deletes: parseBool(row["Deletes"]),
      notes: toStr(row["Notes"]) || null,
    });
  });

  // Quality Scores
  qualityRows.forEach((row, i) => {
    const rowNum = i + 2;
    const entityName = toStr(row["Data Entity"]);
    const dimRaw = toStr(row["Dimension"]).toUpperCase();
    const scoreRaw = row["Score (0-100)"] ?? row["Score"];
    const errors: string[] = [];

    if (!entityName) errors.push("Data Entity is required");
    if (!dimRaw) errors.push("Dimension is required");
    else if (!VALID_DQ_DIMENSIONS.includes(dimRaw as (typeof VALID_DQ_DIMENSIONS)[number])) {
      errors.push(`Dimension: invalid value "${dimRaw}"`);
    }

    let score = 0;
    const parsed = parseInt(String(scoreRaw ?? ""), 10);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      errors.push("Score: must be an integer 0–100");
    } else {
      score = parsed;
    }

    if (entityName) {
      const inDb = entityByName.has(entityName.toLowerCase());
      const inBatch = entitiesValid.some((e) => e.name.toLowerCase() === entityName.toLowerCase());
      if (!inDb && !inBatch) {
        errors.push(`Data Entity "${entityName}" not found`);
      }
    }

    if (errors.length > 0) {
      rowErrors.push({ sheet: "Quality Scores", rowNum, name: entityName, errors });
      return;
    }

    qualityValid.push({
      rowNum,
      entityName,
      dimension: dimRaw as (typeof VALID_DQ_DIMENSIONS)[number],
      score,
      note: toStr(row["Note"]) || null,
    });
  });

  const summary = {
    domains: { total: domainRows.length, valid: domainsValid.length },
    entities: { total: entityRows.length, valid: entitiesValid.length },
    crud: { total: usageRows.length, valid: usagesValid.length },
    quality: { total: qualityRows.length, valid: qualityValid.length },
    errors: rowErrors,
  };

  if (action === "validate") {
    return NextResponse.json(summary);
  }

  // --- Import mode ---
  // 1) Upsert domains
  const upsertedDomainIds = new Map<string, string>(); // lowercase name -> id
  for (const d of domainsValid) {
    const existing = domainByName.get(d.name.toLowerCase());
    if (existing) {
      await db.dataDomain.update({
        where: { id: existing.id },
        data: {
          description: d.description,
          color: d.color ?? undefined,
          ownerId: d.ownerId,
          stewardId: d.stewardId,
        },
      });
      upsertedDomainIds.set(d.name.toLowerCase(), existing.id);
    } else {
      const created = await db.dataDomain.create({
        data: {
          workspaceId,
          name: d.name,
          description: d.description,
          color: d.color ?? "#0B5CD6",
          ownerId: d.ownerId,
          stewardId: d.stewardId,
        },
      });
      upsertedDomainIds.set(d.name.toLowerCase(), created.id);
      domainByName.set(d.name.toLowerCase(), { id: created.id, name: d.name });
    }
  }

  // 2) Upsert entities (domain must already exist after step 1)
  const upsertedEntityIds = new Map<string, string>();
  for (const e of entitiesValid) {
    const domain = domainByName.get(e.domainName.toLowerCase());
    if (!domain) continue; // validation should have prevented this
    const goldenSourceAppId = e.goldenSourceAppName
      ? appByName.get(e.goldenSourceAppName.toLowerCase())?.id ?? null
      : null;

    const existing = entityByName.get(e.name.toLowerCase());
    if (existing) {
      await db.dataEntity.update({
        where: { id: existing.id },
        data: {
          domainId: domain.id,
          description: e.description,
          entityType: e.entityType,
          classification: e.classification,
          regulatoryTags: e.regulatoryTags,
          goldenSourceAppId,
          retentionDays: e.retentionDays,
          businessOwnerId: e.businessOwnerId,
          stewardId: e.stewardId,
          custodianId: e.custodianId,
        },
      });
      upsertedEntityIds.set(e.name.toLowerCase(), existing.id);
    } else {
      const created = await db.dataEntity.create({
        data: {
          workspaceId,
          domainId: domain.id,
          name: e.name,
          description: e.description,
          entityType: e.entityType,
          classification: e.classification,
          regulatoryTags: e.regulatoryTags,
          goldenSourceAppId,
          retentionDays: e.retentionDays,
          businessOwnerId: e.businessOwnerId,
          stewardId: e.stewardId,
          custodianId: e.custodianId,
        },
      });
      upsertedEntityIds.set(e.name.toLowerCase(), created.id);
      entityByName.set(e.name.toLowerCase(), {
        id: created.id,
        name: e.name,
        domainId: domain.id,
      });
    }
  }

  // 3) CRUD matrix — upsert by (appId, entityId)
  let usagesWritten = 0;
  for (const u of usagesValid) {
    const app = appByName.get(u.appName.toLowerCase());
    const entity = entityByName.get(u.entityName.toLowerCase());
    if (!app || !entity) continue;
    await db.appEntityUsage.upsert({
      where: { appId_entityId: { appId: app.id, entityId: entity.id } },
      create: {
        workspaceId,
        appId: app.id,
        entityId: entity.id,
        creates: u.creates,
        reads: u.reads,
        updates: u.updates,
        deletes: u.deletes,
        notes: u.notes,
      },
      update: {
        creates: u.creates,
        reads: u.reads,
        updates: u.updates,
        deletes: u.deletes,
        notes: u.notes,
      },
    });
    usagesWritten++;
  }

  // 4) Quality scores — append (historical records, not upsert)
  let scoresWritten = 0;
  if (qualityValid.length > 0) {
    const res = await db.dataQualityScore.createMany({
      data: qualityValid
        .map((q) => {
          const entity = entityByName.get(q.entityName.toLowerCase());
          if (!entity) return null;
          return {
            entityId: entity.id,
            dimension: q.dimension,
            score: q.score,
            note: q.note,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
    });
    scoresWritten = res.count;
  }

  return NextResponse.json({
    ...summary,
    imported: {
      domains: upsertedDomainIds.size,
      entities: upsertedEntityIds.size,
      usages: usagesWritten,
      qualityScores: scoresWritten,
    },
  });
}
