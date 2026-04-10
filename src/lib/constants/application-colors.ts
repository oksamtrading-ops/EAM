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

// Numeric mapping for quadrant positioning
export const BV_NUMERIC: Record<string, number> = {
  BV_UNKNOWN: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4,
};

export const TH_NUMERIC: Record<string, number> = {
  TH_UNKNOWN: 0, TH_CRITICAL: 1, POOR: 2, FAIR: 3, GOOD: 4, EXCELLENT: 5,
};
