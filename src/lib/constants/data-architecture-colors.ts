// Color and label constants for Module 6: Data Architecture
// Follows the pattern established in application-colors.ts

export const CLASSIFICATION_COLORS: Record<string, string> = {
  PUBLIC: "#94a3b8",
  INTERNAL: "#3b82f6",
  CONFIDENTIAL: "#f97316",
  RESTRICTED: "#dc2626",
  DC_UNKNOWN: "#cbd5e1",
};

export const CLASSIFICATION_LABELS: Record<string, string> = {
  PUBLIC: "Public",
  INTERNAL: "Internal",
  CONFIDENTIAL: "Confidential",
  RESTRICTED: "Restricted",
  DC_UNKNOWN: "Not Classified",
};

export const ENTITY_TYPE_COLORS: Record<string, string> = {
  MASTER: "#7c3aed",
  REFERENCE: "#0ea5e9",
  TRANSACTIONAL: "#16a34a",
  ANALYTICAL: "#eab308",
  METADATA: "#94a3b8",
};

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  MASTER: "Master",
  REFERENCE: "Reference",
  TRANSACTIONAL: "Transactional",
  ANALYTICAL: "Analytical",
  METADATA: "Metadata",
};

export const REGULATORY_TAG_LABELS: Record<string, string> = {
  PII: "PII",
  PHI: "PHI",
  PCI: "PCI",
  GDPR: "GDPR",
  CCPA: "CCPA",
  SOX: "SOX",
  HIPAA: "HIPAA",
  FERPA: "FERPA",
};

// All regulatory tags are treated as sensitivity indicators — use a warm palette.
export const REGULATORY_TAG_COLORS: Record<string, string> = {
  PII: "#dc2626",
  PHI: "#dc2626",
  PCI: "#f97316",
  GDPR: "#7c3aed",
  CCPA: "#7c3aed",
  SOX: "#0ea5e9",
  HIPAA: "#dc2626",
  FERPA: "#eab308",
};

export const DQ_DIMENSION_LABELS: Record<string, string> = {
  COMPLETENESS: "Completeness",
  ACCURACY: "Accuracy",
  CONSISTENCY: "Consistency",
  TIMELINESS: "Timeliness",
  UNIQUENESS: "Uniqueness",
  VALIDITY: "Validity",
};

// 0-100 quality score → color band
export function dqScoreColor(score: number): string {
  if (score >= 90) return "#16a34a";
  if (score >= 75) return "#65a30d";
  if (score >= 60) return "#eab308";
  if (score >= 40) return "#f97316";
  return "#dc2626";
}

export const CLASSIFICATION_OPTIONS = [
  "DC_UNKNOWN",
  "PUBLIC",
  "INTERNAL",
  "CONFIDENTIAL",
  "RESTRICTED",
] as const;

export const ENTITY_TYPE_OPTIONS = [
  "MASTER",
  "REFERENCE",
  "TRANSACTIONAL",
  "ANALYTICAL",
  "METADATA",
] as const;

export const REGULATORY_TAG_OPTIONS = [
  "PII",
  "PHI",
  "PCI",
  "GDPR",
  "CCPA",
  "SOX",
  "HIPAA",
  "FERPA",
] as const;
