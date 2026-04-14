export const LIFECYCLE_COLORS: Record<string, string> = {
  PLANNED: "#3b82f6",
  ACTIVE: "#16a34a",
  PHASING_OUT: "#f97316",
  RETIRED: "#94a3b8",
  SUNSET: "#dc2626",
};

export const LIFECYCLE_LABELS: Record<string, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  PHASING_OUT: "Phasing Out",
  RETIRED: "Retired",
  SUNSET: "Sunset",
};

export const BV_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#94a3b8",
  BV_UNKNOWN: "#cbd5e1",
};

export const BV_LABELS: Record<string, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  BV_UNKNOWN: "Unknown",
};

export const TH_COLORS: Record<string, string> = {
  EXCELLENT: "#16a34a",
  GOOD: "#65a30d",
  FAIR: "#eab308",
  POOR: "#f97316",
  TH_CRITICAL: "#dc2626",
  TH_UNKNOWN: "#cbd5e1",
};

export const TH_LABELS: Record<string, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  FAIR: "Fair",
  POOR: "Poor",
  TH_CRITICAL: "Critical",
  TH_UNKNOWN: "Unknown",
};

export const RAT_COLORS: Record<string, string> = {
  KEEP: "#16a34a",
  INVEST: "#3b82f6",
  MIGRATE: "#f97316",
  RETIRE: "#dc2626",
  CONSOLIDATE: "#8b5cf6",
  EVALUATE: "#eab308",
  RAT_NOT_ASSESSED: "#cbd5e1",
};

export const RAT_LABELS: Record<string, string> = {
  KEEP: "Keep",
  INVEST: "Invest",
  MIGRATE: "Migrate",
  RETIRE: "Retire",
  CONSOLIDATE: "Consolidate",
  EVALUATE: "Evaluate",
  RAT_NOT_ASSESSED: "Not Assessed",
};

export const APP_TYPE_LABELS: Record<string, string> = {
  SAAS: "SaaS",
  COTS: "COTS",
  CUSTOM: "Custom",
  PAAS: "PaaS",
  OPEN_SOURCE: "Open Source",
  LEGACY: "Legacy",
};

export const DEPLOY_LABELS: Record<string, string> = {
  CLOUD_PUBLIC: "Public Cloud",
  CLOUD_PRIVATE: "Private Cloud",
  ON_PREMISE: "On-Premise",
  HYBRID: "Hybrid",
  SAAS_HOSTED: "SaaS",
  UNKNOWN: "Unknown",
};

export const FF_COLORS: Record<string, string> = {
  EXCELLENT: "#16a34a",
  GOOD: "#65a30d",
  ADEQUATE: "#eab308",
  POOR: "#f97316",
  UNFIT: "#dc2626",
  FF_UNKNOWN: "#cbd5e1",
};

export const FF_LABELS: Record<string, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  ADEQUATE: "Adequate",
  POOR: "Poor",
  UNFIT: "Unfit",
  FF_UNKNOWN: "Unknown",
};

export const DC_COLORS: Record<string, string> = {
  PUBLIC: "#16a34a",
  INTERNAL: "#3b82f6",
  CONFIDENTIAL: "#f97316",
  RESTRICTED: "#dc2626",
  DC_UNKNOWN: "#cbd5e1",
};

export const DC_LABELS: Record<string, string> = {
  PUBLIC: "Public",
  INTERNAL: "Internal",
  CONFIDENTIAL: "Confidential",
  RESTRICTED: "Restricted",
  DC_UNKNOWN: "Unknown",
};

export const IFACE_PROTOCOL_LABELS: Record<string, string> = {
  REST_API: "REST API",
  SOAP: "SOAP",
  GRAPHQL: "GraphQL",
  FILE_TRANSFER: "File Transfer",
  DATABASE_LINK: "DB Link",
  MESSAGE_QUEUE: "Message Queue",
  EVENT_STREAM: "Event Stream",
  ETL: "ETL",
  SFTP: "SFTP",
  CUSTOM: "Custom",
};

export const IFACE_CRITICALITY_COLORS: Record<string, string> = {
  INT_CRITICAL: "#dc2626",
  INT_HIGH: "#f97316",
  INT_MEDIUM: "#eab308",
  INT_LOW: "#94a3b8",
};

export const IFACE_CRITICALITY_LABELS: Record<string, string> = {
  INT_CRITICAL: "Critical",
  INT_HIGH: "High",
  INT_MEDIUM: "Medium",
  INT_LOW: "Low",
};

export const IFACE_DIRECTION_LABELS: Record<string, string> = {
  INBOUND: "Inbound",
  OUTBOUND: "Outbound",
  BIDIRECTIONAL: "Bidirectional",
};

// Numeric mapping for quadrant positioning
export const BV_NUMERIC: Record<string, number> = {
  BV_UNKNOWN: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4,
};

export const TH_NUMERIC: Record<string, number> = {
  TH_UNKNOWN: 0, TH_CRITICAL: 1, POOR: 2, FAIR: 3, GOOD: 4, EXCELLENT: 5,
};

export const FF_NUMERIC: Record<string, number> = {
  FF_UNKNOWN: 0, UNFIT: 1, POOR: 2, ADEQUATE: 3, GOOD: 4, EXCELLENT: 5,
};
