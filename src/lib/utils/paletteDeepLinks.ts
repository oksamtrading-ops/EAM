// Deep-link resolver used by the Cmd+K palette for entity navigation
// and for the "Dig Deeper" button → opens the relevant AI panel.

export type EntityType =
  | "Application"
  | "Capability"
  | "Risk"
  | "Initiative"
  | "Tag"
  | "OrgUnit";

export function paletteDeepLink(type: EntityType, id: string): string {
  switch (type) {
    case "Application":
      return `/applications?appId=${encodeURIComponent(id)}`;
    case "Capability":
      return `/capabilities?id=${encodeURIComponent(id)}`;
    case "Risk":
      return `/risk?riskId=${encodeURIComponent(id)}`;
    case "Initiative":
      return `/roadmap?initiativeId=${encodeURIComponent(id)}`;
    case "Tag":
      return `/tags?id=${encodeURIComponent(id)}`;
    case "OrgUnit":
      return `/capabilities?orgId=${encodeURIComponent(id)}`;
    default:
      return "/";
  }
}

// Dig Deeper opens the entity's AI panel via a URL flag the page reads.
export function digDeeperLink(type: EntityType, id: string): string {
  switch (type) {
    case "Application":
      return `/applications?appId=${encodeURIComponent(id)}&ai=1`;
    case "Capability":
      return `/capabilities?id=${encodeURIComponent(id)}&ai=1`;
    case "Risk":
      return `/risk?riskId=${encodeURIComponent(id)}&ai=1`;
    case "Initiative":
      return `/roadmap?initiativeId=${encodeURIComponent(id)}&ai=1`;
    default:
      return paletteDeepLink(type, id);
  }
}

export function quickActionLink(action: { type: string; url?: string }): string {
  if (action.url) return action.url;
  switch (action.type) {
    case "NEW_APP":
      return "/applications?new=1";
    case "NEW_RISK":
      return "/risk?new=1";
    case "NEW_INITIATIVE":
      return "/roadmap?new=1";
    case "AUTO_MAP":
      return "/applications?autoMap=1";
    default:
      return "/";
  }
}
