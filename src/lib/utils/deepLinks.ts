export function deepLink(entityType: string, entityId: string): string {
  switch (entityType) {
    case "TechRisk":
      return `/risk?riskId=${entityId}`;
    case "Application":
      return `/applications`;
    case "Initiative":
      return `/roadmap`;
    case "BusinessCapability":
      return `/capabilities?id=${entityId}`;
    case "ComplianceRequirement":
      return `/risk?view=compliance`;
    case "EolWatchEntry":
      return `/risk?view=eol`;
    case "TechRadarEntry":
      return `/risk?view=radar`;
    default:
      return `/`;
  }
}
