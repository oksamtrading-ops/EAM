"use client";

import { createContext, useContext } from "react";

type WorkspaceContext = {
  workspaceId: string;
  workspaceName: string;
  industry: string;
};

const WorkspaceCtx = createContext<WorkspaceContext | null>(null);

export function WorkspaceProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: WorkspaceContext;
}) {
  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
