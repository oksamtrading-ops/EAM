// Centralized design tokens — single source of truth for brand colors
// Used across all components instead of hard-coded hex values

export const BRAND = {
  // Brand blue
  primary: "#0B5CD6",
  primaryHover: "#094cb0",
  primaryLight: "rgba(11, 92, 214, 0.1)",
  primarySubtle: "rgba(11, 92, 214, 0.05)",

  // AI accent — purple, reserved for AI-generated surfaces
  ai: "#7c3aed",
  aiHover: "#6d28d9",
  aiLight: "rgba(124, 58, 237, 0.1)",
  aiSubtle: "rgba(124, 58, 237, 0.05)",

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
