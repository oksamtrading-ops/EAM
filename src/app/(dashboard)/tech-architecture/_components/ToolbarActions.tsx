"use client";

import { createPortal } from "react-dom";
import { useTechArchToolbar } from "./TechArchToolbarContext";

export function ToolbarActions({ children }: { children: React.ReactNode }) {
  const { actionsEl } = useTechArchToolbar();
  if (!actionsEl) return null;
  return createPortal(<>{children}</>, actionsEl);
}
