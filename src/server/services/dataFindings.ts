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
  | "SENSITIVE_NO_STEWARD";

export type DataFinding = {
  entityId: string;
  entityName: string;
  domainId: string;
  domainName: string;
  kind: DataFindingKind;
  classification: string;
  regulatoryTags: string[];
};

/**
 * Stable, unique `sourceType` string for a given finding kind — used by
 * Risk auto-scan to dedup auto-generated risks (one risk per entity per
 * finding kind) and to close stale findings when the underlying gap is
 * resolved.
 */
export function dataFindingSourceType(kind: DataFindingKind): string {
  return `DATA_${kind}`;
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
  for (const e of entities) {
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
