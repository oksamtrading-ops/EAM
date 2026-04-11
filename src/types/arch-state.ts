export type ArchStateSnapshot = {
  version: 1;
  capturedAt: string;
  stateType: "AS_IS" | "TO_BE";
  label: string;

  capabilities: Array<{
    id: string;
    name: string;
    level: string;
    currentMaturity: string;
    targetMaturity: string;
    strategicImportance: string;
  }>;

  applications: Array<{
    id: string;
    name: string;
    lifecycle: string;
    rationalizationStatus: string;
    businessValue: string;
    technicalHealth: string;
    capabilityIds: string[];
  }>;

  gaps: Array<{ capabilityId: string; capabilityName: string }>;
  redundancies: Array<{
    capabilityId: string;
    capabilityName: string;
    appCount: number;
  }>;
};
