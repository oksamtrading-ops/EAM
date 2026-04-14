"use client";

import { useState } from "react";
import {
  ChevronDown,
  Plus,
  Check,
  Building2,
  CircleDot,
  CircleOff,
} from "lucide-react";
import { useWorkspace, type WorkspaceInfo } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

interface Props {
  onCreateNew: () => void;
}

export function WorkspaceSwitcher({ onCreateNew }: Props) {
  const { workspaceId, workspaceName, industry, workspaces, switchWorkspace } =
    useWorkspace();
  const [open, setOpen] = useState(false);

  const activeWorkspaces = workspaces.filter((w) => w.isActive);
  const inactiveWorkspaces = workspaces.filter((w) => !w.isActive);

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors border-b border-border"
      >
        <div
          className="h-8 w-8 rounded-xl flex items-center justify-center shadow-sm shrink-0"
          style={{
            background: "linear-gradient(135deg, var(--primary) 0%, #5e8a1a 100%)",
          }}
        >
          <Building2 className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[13px] text-foreground tracking-tight leading-tight truncate">
            {workspaceName}
          </p>
          <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
            {industry}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground/50 transition-transform shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown — pops out in light theme since it overlays the page */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          <div className="absolute left-3 right-3 top-full mt-1 z-50 glass-overlay rounded-xl overflow-hidden">
            <div className="py-1.5 max-h-[320px] overflow-y-auto">
              {/* Active workspaces */}
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Workspaces
              </p>
              {activeWorkspaces.map((ws) => (
                <WorkspaceItem
                  key={ws.id}
                  workspace={ws}
                  isSelected={ws.id === workspaceId}
                  onClick={() => {
                    if (ws.id !== workspaceId) {
                      switchWorkspace(ws.id);
                    }
                    setOpen(false);
                  }}
                />
              ))}

              {/* Inactive workspaces */}
              {inactiveWorkspaces.length > 0 && (
                <>
                  <div className="mx-3 my-1.5 border-t border-border" />
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Deactivated
                  </p>
                  {inactiveWorkspaces.map((ws) => (
                    <WorkspaceItem
                      key={ws.id}
                      workspace={ws}
                      isSelected={false}
                      onClick={() => {}}
                      disabled
                    />
                  ))}
                </>
              )}
            </div>

            {/* Create new */}
            <div className="border-t border-border">
              <button
                onClick={() => {
                  setOpen(false);
                  onCreateNew();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-medium text-primary hover:bg-primary/5 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create New Workspace
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function WorkspaceItem({
  workspace,
  isSelected,
  onClick,
  disabled,
}: {
  workspace: WorkspaceInfo;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-muted/30 cursor-pointer",
        isSelected && "bg-primary/5"
      )}
    >
      {workspace.isActive ? (
        <CircleDot
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            isSelected ? "text-primary" : "text-muted-foreground"
          )}
        />
      ) : (
        <CircleOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-[13px] font-medium truncate",
            isSelected ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {workspace.name}
        </p>
        {workspace.clientName && (
          <p className="text-[10px] text-muted-foreground truncate">
            {workspace.clientName}
          </p>
        )}
      </div>
      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
      {workspace.isDefault && !isSelected && (
        <span className="text-[9px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0">
          Default
        </span>
      )}
    </button>
  );
}
