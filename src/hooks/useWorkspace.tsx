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
  workspaceId: string;
  workspaceName: string;
  industry: string;
  workspaces: WorkspaceInfo[];
  switchWorkspace: (id: string) => void;
  setWorkspaces: (ws: WorkspaceInfo[]) => void;
};

const WorkspaceCtx = createContext<WorkspaceContextValue | null>(null);

const COOKIE_KEY = "eam-active-workspace";

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
  const [activeId] = useState<string>(defaultWorkspaceId);

  // If activeId is no longer in the list (deleted/deactivated), fall back
  useEffect(() => {
    const exists = workspaces.some((w) => w.id === activeId && w.isActive);
    if (!exists && workspaces.length > 0) {
      const fallback =
        workspaces.find((w) => w.isDefault && w.isActive) ??
        workspaces.find((w) => w.isActive);
      if (fallback) {
        document.cookie = `${COOKIE_KEY}=${fallback.id}; path=/; max-age=${60 * 60 * 24 * 365}`;
        window.location.reload();
      }
    }
  }, [workspaces, activeId]);

  const activeWs = workspaces.find((w) => w.id === activeId) ?? workspaces[0];

  const switchWorkspace = useCallback((id: string) => {
    // Write cookie — server layout reads it on next request
    document.cookie = `${COOKIE_KEY}=${id}; path=/; max-age=${60 * 60 * 24 * 365}`;
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
