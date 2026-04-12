// Module 4 → Module 5 boundary contracts

export type RiskSummary = {
  workspaceId: string;
  totalRisks: number;
  openRisks: number;
  criticalRisks: number;
  unmitigated: number;
  complianceScore: number; // 0–100 average across all frameworks
  eolExpired: number;
  eolUrgent: number;
  riskTrend: "IMPROVING" | "STABLE" | "WORSENING";
};

export type ComplianceFrameworkStatus = {
  framework: string;
  score: number; // 0–100
  total: number;
  compliant: number;
  partial: number;
  nonCompliant: number;
  notAssessed: number;
};

export type RiskDashboardData = {
  summary: RiskSummary;
  complianceByFramework: ComplianceFrameworkStatus[];
  topOpenRisks: Array<{
    id: string;
    title: string;
    score: number;
    category: string;
  }>;
  eolUrgentItems: Array<{
    id: string;
    name: string;
    eolDate: Date | null;
    urgencyBand: string;
  }>;
};
