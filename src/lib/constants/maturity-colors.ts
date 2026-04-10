export const MATURITY_COLORS: Record<string, string> = {
  OPTIMIZING: "#16a34a",   // green-600
  MANAGED: "#65a30d",      // lime-600
  DEFINED: "#ca8a04",      // yellow-600
  DEVELOPING: "#ea580c",   // orange-600
  INITIAL: "#dc2626",      // red-600
  NOT_ASSESSED: "#94a3b8", // slate-400
};

export const IMPORTANCE_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",     // red-600
  HIGH: "#ea580c",         // orange-600
  MEDIUM: "#ca8a04",       // yellow-600
  LOW: "#65a30d",          // lime-600
  NOT_ASSESSED: "#94a3b8", // slate-400
};

export const MATURITY_LABELS: Record<string, string> = {
  INITIAL: "1 - Initial",
  DEVELOPING: "2 - Developing",
  DEFINED: "3 - Defined",
  MANAGED: "4 - Managed",
  OPTIMIZING: "5 - Optimizing",
  NOT_ASSESSED: "Not Assessed",
};

export const MATURITY_NUMERIC: Record<string, number> = {
  INITIAL: 1,
  DEVELOPING: 2,
  DEFINED: 3,
  MANAGED: 4,
  OPTIMIZING: 5,
  NOT_ASSESSED: 0,
};

export const IMPORTANCE_LABELS: Record<string, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  NOT_ASSESSED: "Not Assessed",
};
