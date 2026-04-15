import type { db } from "@/server/db";

type DB = typeof db;

/**
 * Governance gap kinds surfaced by the data catalog.
 *
 * This is the **single source of truth** for "what's wrong with the data
 * catalog right now." Both the Dashboard DataKpiStrip and the Risk
 * runAutoScan mutation call `computeDataFindings` to keep counts and
 * findings perfectly consistent.
 */
export type DataFindingKind =
  | "UNCLASSIFIED"
  | "NO_STEWARD"
  | "NO_OWNER"
  | "NO_CUSTODIAN"
  | "NO_GOLDEN"
  | "SENSITIVE_NO_STEWARD"
  | "ATTRIBUTE_SENSITIVE_NO_CLASSIFICATION"
  | "ENTITY_NO_PRIMARY_KEY";

export type DataFinding = {
  entityId: string;
  entityName: string;
  domainId: string;
  domainName: string;
  kind: DataFindingKind;
  classification: string;
  regulatoryTags: string[];
  /**
   * Attribute-level findings carry the attribute id/name. Entity-level
   * findings leave these undefined. Used by {@link dataFindingSourceEntityId}
   * so Risk auto-scan can dedup per-attribute (not per-entity).
   */
  attributeId?: string;
  attributeName?: string;
};

/**
 * Stable, unique `sourceType` string for a given finding kind — used by
 * Risk auto-scan to dedup auto-generated risks (one risk per source entity
 * per finding kind) and to close stale findings when the underlying gap is
 * resolved.
 */
export function dataFindingSourceType(kind: DataFindingKind): string {
  return `DATA_${kind}`;
}

/**
 * Which id to use as the Risk `sourceEntityId` for a finding. Attribute-level
 * findings must dedup per-attribute so that fixing one field doesn't close
 * risks for other fields on the same entity.
 */
export function dataFindingSourceEntityId(f: DataFinding): string {
  return f.attributeId ?? f.entityId;
}

export const DATA_FINDING_SOURCE_TYPE_PREFIX = "DATA_";

export async function computeDataFindings(
  db: DB,
  workspaceId: string
): Promise<DataFinding[]> {
  const entities = await db.dataEntity.findMany({
    where: { workspaceId, isActive: true },
    select: {
      id: true,
      name: true,
      classification: true,
      regulatoryTags: true,
      stewardId: true,
      businessOwnerId: true,
      custodianId: true,
      goldenSourceAppId: true,
      domain: { select: { id: true, name: true } },
    },
  });

  const findings: DataFinding[] = [];
  const entityMeta = new Map<
    string,
    { name: string; domainId: string; domainName: string }
  >();
  for (const e of entities) {
    entityMeta.set(e.id, {
      name: e.name,
      domainId: e.domain.id,
      domainName: e.domain.name,
    });

    const sensitive =
      e.classification === "CONFIDENTIAL" || e.classification === "RESTRICTED";

    if (e.classification === "DC_UNKNOWN") {
      findings.push(makeFinding(e, "UNCLASSIFIED"));
    }
    if (!e.stewardId) {
      findings.push(
        makeFinding(e, sensitive ? "SENSITIVE_NO_STEWARD" : "NO_STEWARD")
      );
    }
    if (!e.businessOwnerId) {
      findings.push(makeFinding(e, "NO_OWNER"));
    }
    if (!e.custodianId) {
      findings.push(makeFinding(e, "NO_CUSTODIAN"));
    }
    if (!e.goldenSourceAppId && sensitive) {
      findings.push(makeFinding(e, "NO_GOLDEN"));
    }
  }

  // Attribute-level findings (only for attributes under active entities).
  const attributes = await db.dataAttribute.findMany({
    where: { workspaceId, entity: { isActive: true } },
    select: {
      id: true,
      name: true,
      entityId: true,
      classification: true,
      regulatoryTags: true,
      isPrimaryKey: true,
    },
  });

  const byEntity = new Map<string, { hasPk: boolean; count: number }>();
  for (const a of attributes) {
    const cur = byEntity.get(a.entityId) ?? { hasPk: false, count: 0 };
    cur.count += 1;
    if (a.isPrimaryKey) cur.hasPk = true;
    byEntity.set(a.entityId, cur);

    // ATTRIBUTE_SENSITIVE_NO_CLASSIFICATION — attribute has at least one
    // regulatory tag but is classified DC_UNKNOWN. Per-attribute dedup.
    if (a.regulatoryTags.length > 0 && a.classification === "DC_UNKNOWN") {
      const meta = entityMeta.get(a.entityId);
      if (!meta) continue;
      findings.push({
        entityId: a.entityId,
        entityName: meta.name,
        domainId: meta.domainId,
        domainName: meta.domainName,
        kind: "ATTRIBUTE_SENSITIVE_NO_CLASSIFICATION",
        classification: a.classification,
        regulatoryTags: a.regulatoryTags as string[],
        attributeId: a.id,
        attributeName: a.name,
      });
    }
  }

  // ENTITY_NO_PRIMARY_KEY — entity has ≥1 attribute but none are PK.
  // Entity-level finding (not one per attribute) to avoid spam.
  for (const [entityId, info] of byEntity) {
    if (info.count > 0 && !info.hasPk) {
      const meta = entityMeta.get(entityId);
      if (!meta) continue;
      findings.push({
        entityId,
        entityName: meta.name,
        domainId: meta.domainId,
        domainName: meta.domainName,
        kind: "ENTITY_NO_PRIMARY_KEY",
        classification: "",
        regulatoryTags: [],
      });
    }
  }

  return findings;
}

function makeFinding(
  e: {
    id: string;
    name: string;
    classification: string;
    regulatoryTags: readonly string[];
    domain: { id: string; name: string };
  },
  kind: DataFindingKind
): DataFinding {
  return {
    entityId: e.id,
    entityName: e.name,
    domainId: e.domain.id,
    domainName: e.domain.name,
    kind,
    classification: e.classification,
    regulatoryTags: e.regulatoryTags as string[],
  };
}
