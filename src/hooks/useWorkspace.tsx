"use client";

import { createContext, useContext, useCallback, useState, useEffect } from "react";

export type WorkspaceInfo = {
  id: string;
  name: string;
  industry: string;
  clientName?: string | null;
  isDefault: boolean;
  isActive: boolean;
};

type WorkspaceContextValue = {
  /** Currently active workspace */
  workspaceId: string;
  workspaceName: string;
  industry: string;
  /** All workspaces the user has access to */
  workspaces: WorkspaceInfo[];
  /** Switch to a different workspace */
  switchWorkspace: (id: string) => void;
  /** Refresh the workspace list (call after create/delete/update) */
  setWorkspaces: (ws: WorkspaceInfo[]) => void;
};

const WorkspaceCtx = createContext<WorkspaceContextValue | null>(null);

const LS_KEY = "eam-active-workspace";

export function WorkspaceProvider({
  children,
  workspaces: initialWorkspaces,
  defaultWorkspaceId,
}: {
  children: React.ReactNode;
  workspaces: WorkspaceInfo[];
  defaultWorkspaceId: string;
}) {
  const [workspaces, setWorkspacesState] = useState<WorkspaceInfo[]>(initialWorkspaces);

  // Determine initial workspace: localStorage override > default
  const [activeId, setActiveId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(LS_KEY);
      // Only use stored if it exists in the workspace list
      if (stored && initialWorkspaces.some((w) => w.id === stored && w.isActive)) {
        return stored;
      }
    }
    return defaultWorkspaceId;
  });

  // If activeId is no longer in the list (deleted/deactivated), fall back
  useEffect(() => {
    const exists = workspaces.some((w) => w.id === activeId && w.isActive);
    if (!exists && workspaces.length > 0) {
      const fallback = workspaces.find((w) => w.isDefault && w.isActive) ?? workspaces.find((w) => w.isActive);
      if (fallback) {
        setActiveId(fallback.id);
        localStorage.setItem(LS_KEY, fallback.id);
      }
    }
  }, [workspaces, activeId]);

  const activeWs = workspaces.find((w) => w.id === activeId) ?? workspaces[0];

  const switchWorkspace = useCallback((id: string) => {
    setActiveId(id);
    localStorage.setItem(LS_KEY, id);
    // Force a full page reload to reset all tRPC caches cleanly
    window.location.reload();
  }, []);

  const setWorkspaces = useCallback((ws: WorkspaceInfo[]) => {
    setWorkspacesState(ws);
  }, []);

  return (
    <WorkspaceCtx.Provider
      value={{
        workspaceId: activeWs?.id ?? activeId,
        workspaceName: activeWs?.name ?? "Workspace",
        industry: activeWs?.industry ?? "GENERIC",
        workspaces,
        switchWorkspace,
        setWorkspaces,
      }}
    >
      {children}
    </WorkspaceCtx.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
