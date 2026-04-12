export interface DashboardKpis {
  totalCapabilities: number;
  criticalCapabilities: number;
  totalApplications: number;
  appsWithEolRisk: number;
  openRisks: number;
  criticalRisks: number;
  avgComplianceScore: number;
  overdueInitiatives: number;
  totalAnnualCost: number;
  costCurrency: string;
  upcomingRenewals: number;
}

export interface CostByDomain {
  domainId: string;
  domain: string;
  totalCost: number;
  appCount: number;
}

export interface ActionItem {
  id: string;
  type: "RISK" | "EOL" | "COMPLIANCE" | "INITIATIVE";
  severity: "critical" | "high" | "medium";
  title: string;
  description: string;
  href: string;
}

export interface ActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  label: string;
  href: string;
  actorName: string;
  occurredAt: Date;
}

export interface PinnedItem {
  id: string;
  entityType: string;
  entityId: string;
  label: string;
  href: string;
  createdAt: Date;
}

// ─── V2 Dashboard types ───────────────────────────────────────────────────────

export type DateRangeKey = "7d" | "30d" | "90d" | "6mo" | "1yr" | "2yr" | "all";

export interface KpiDelta {
  current: number;
  delta: number | null; // null when "all" (no comparison period)
  direction: "up" | "down" | "flat" | null;
}

export interface DashboardKpisV2 {
  totalApplications: KpiDelta;
  totalCapabilities: KpiDelta;
  openRisks: KpiDelta;
  avgComplianceScore: KpiDelta;
  // secondary chips (no delta)
  criticalRisks: number;
  appsWithEolRisk: number;
  overdueInitiatives: number;
}

export interface MigrationTrendPoint {
  month: string; // "Jan 25"
  Cloud: number;
  OnPremise: number;
  Hybrid: number;
  SaaS: number;
}

export interface AppHealthDistribution {
  healthy: number;
  warning: number;
  critical: number;
  total: number;
}

export interface CapabilityMaturityDomain {
  domainId: string;
  domain: string;
  avgMaturity: number; // 0–5 numeric
  count: number;
}

export interface RecentAchievement {
  id: string;
  type: "INITIATIVE_COMPLETE" | "RISK_RESOLVED" | "EOL_ACKNOWLEDGED";
  title: string;
  description: string;
  completedAt: Date;
  href: string;
}

export type DrillDownFilter =
  | { kind: "apps_by_health"; bucket: "healthy" | "warning" | "critical" }
  | { kind: "risks"; severity: "critical" | "high" | "all" }
  | { kind: "capabilities_by_domain"; domainId: string; domainName: string }
  | { kind: "eol_risk" }
  | { kind: "overdue_initiatives" };

export interface DrillDownRow {
  id: string;
  label: string;
  sublabel: string;
  badge?: string;
  badgeVariant?: "destructive" | "warning" | "success" | "outline";
  href: string;
}

export interface DrillDownResult {
  items: DrillDownRow[];
  total: number;
}
