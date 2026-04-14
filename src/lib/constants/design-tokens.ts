/**
 * Design tokens for JS contexts (Recharts, programmatic style computation).
 *
 * For component styling, use Tailwind CSS classes that reference CSS variables:
 *   text-foreground, bg-primary, border-border, bg-card, text-muted-foreground, etc.
 *
 * These values mirror the CSS variables in src/app/globals.css.
 * Only use these constants when you cannot use CSS classes (e.g. chart configs).
 */

export const BRAND = {
  // Brand blue — use `bg-primary` / `text-primary` in components
  primary: "#0B5CD6",
  primaryHover: "#094cb0",
  primaryLight: "rgba(11, 92, 214, 0.1)",
  primarySubtle: "rgba(11, 92, 214, 0.05)",

  // AI accent — use `text-[var(--ai)]` / `bg-[var(--ai-subtle)]` in components
  ai: "#7c3aed",
  aiHover: "#6d28d9",
  aiLight: "rgba(124, 58, 237, 0.1)",
  aiSubtle: "rgba(124, 58, 237, 0.05)",

  // Text — use `text-foreground` / `text-muted-foreground` in components
  textPrimary: "#1a1a1a",
  textSecondary: "#44495a",
  textMuted: "#6c757d",

  // Backgrounds — use `bg-background` / `bg-card` / `bg-muted` in components
  pageBg: "#f0f3f7",
  cardBg: "rgba(255, 255, 255, 0.72)",
  mutedBg: "rgba(100, 100, 100, 0.09)",

  // Borders — use `border-border` in components
  border: "rgba(0, 0, 0, 0.08)",
} as const;

/** Chart color palette — matches --chart-1 through --chart-5 CSS vars */
export const CHART_COLORS = [
  "#0B5CD6",
  "#0EA5E9",
  "#38BDF8",
  "#1E40AF",
  "#63666A",
] as const;
