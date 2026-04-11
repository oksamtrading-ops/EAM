// Module 3 — Architecture & Roadmap Planning
// Boundary contracts consumed by Module 4 (Risk & Compliance) and Module 5 (Reporting)

export type InitiativeReference = {
  initiativeId: string;
  name: string;
  status: string;
  horizon: string;
  priority: string;
  progressPct: number;
  startDate: Date | null;
  endDate: Date | null;
};

export type TransformationPlan = {
  objectives: Array<{
    id: string;
    name: string;
    targetDate: Date | null;
    kpiTarget: string | null;
  }>;
  initiatives: InitiativeReference[];
  archStates: Array<{
    id: string;
    stateType: string;
    label: string;
    createdAt: Date;
  }>;
};

// Consumed by Module 4 (Risk & Compliance) to assess risk against planned changes
export type PlannedChange = {
  initiativeId: string;
  initiativeName: string;
  capabilityId: string;
  applicationId?: string;
  changeType: string;
  plannedDate?: Date;
};
