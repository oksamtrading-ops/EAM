"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";

/**
 * Thin wrapper around next-themes. Mounted in the root layout so
 * every page can read/write the theme via `useTheme()`. The toggle
 * lives in DashboardShell's top bar.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
