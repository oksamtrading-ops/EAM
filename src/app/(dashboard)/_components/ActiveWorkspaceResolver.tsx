"use client";

import { useState, type ReactNode } from "react";
import type { WorkspaceInfo } from "@/hooks/useWorkspace";

const LS_KEY = "eam-active-workspace";

/**
 * Client component that reads localStorage to determine the active workspace
 * and passes it to the render function. This allows TRPCProvider to be initialized
 * with the correct workspace ID on the client side.
 */
export function ActiveWorkspaceResolver({
  workspaces,
  defaultWorkspaceId,
  children,
}: {
  workspaces: WorkspaceInfo[];
  defaultWorkspaceId: string;
  children: (activeWorkspaceId: string) => ReactNode;
}) {
  const [activeId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(LS_KEY);
      if (stored && workspaces.some((w) => w.id === stored && w.isActive)) {
        return stored;
      }
    }
    return defaultWorkspaceId;
  });

  return <>{children(activeId)}</>;
}
