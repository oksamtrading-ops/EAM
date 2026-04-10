// Centralized design tokens — single source of truth for brand colors
// Used across all components instead of hard-coded hex values

export const BRAND = {
  // Deloitte green
  primary: "#86BC25",
  primaryHover: "#76a821",
  primaryLight: "rgba(134, 188, 37, 0.1)",
  primarySubtle: "rgba(134, 188, 37, 0.05)",

  // Dark sidebar / headings
  dark: "#1a1f2e",
  darkHover: "#2a2f3e",
  darkSubtle: "rgba(26, 31, 46, 0.05)",

  // Backgrounds
  pageBg: "#f8f9fa",
  cardBg: "#ffffff",
  subtleBg: "#fafbfc",
  mutedBg: "#f1f3f5",

  // Borders
  border: "#e9ecef",
  borderLight: "#dee2e6",

  // Text
  textPrimary: "#1a1f2e",
  textSecondary: "#495057",
  textMuted: "#6c757d",
} as const;
