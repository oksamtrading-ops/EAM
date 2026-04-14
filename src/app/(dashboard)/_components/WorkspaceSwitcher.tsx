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
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-black/[0.03] transition-colors"
        style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
      >
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center shadow-sm shrink-0"
          style={{
            background: "linear-gradient(135deg, #0B5CD6 0%, #5e8a1a 100%)",
          }}
        >
          <Building2 className="h-[18px] w-[18px] text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[14px] text-[#1d1d1f] tracking-tight leading-tight truncate">
            {workspaceName}
          </p>
          <p className="text-[11px] text-[#86868b] truncate leading-tight mt-0.5">
            {industry}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-[#86868b] transition-transform shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-white rounded-xl border shadow-lg overflow-hidden">
            <div className="py-1.5 max-h-[320px] overflow-y-auto">
              {/* Active workspaces */}
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#86868b]">
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
                  <div className="mx-3 my-1.5 border-t" />
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#86868b]">
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
            <div className="border-t">
              <button
                onClick={() => {
                  setOpen(false);
                  onCreateNew();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-medium text-[#0B5CD6] hover:bg-[#0B5CD6]/5 transition-colors"
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
          : "hover:bg-black/[0.04] cursor-pointer",
        isSelected && "bg-[#0B5CD6]/8"
      )}
    >
      {workspace.isActive ? (
        <CircleDot
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            isSelected ? "text-[#0B5CD6]" : "text-[#86868b]"
          )}
        />
      ) : (
        <CircleOff className="h-3.5 w-3.5 shrink-0 text-[#86868b]" />
      )}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-[13px] font-medium truncate",
            isSelected ? "text-[#1d1d1f]" : "text-[#3a3a3c]"
          )}
        >
          {workspace.name}
        </p>
        {workspace.clientName && (
          <p className="text-[10px] text-[#86868b] truncate">
            {workspace.clientName}
          </p>
        )}
      </div>
      {isSelected && <Check className="h-4 w-4 text-[#0B5CD6] shrink-0" />}
      {workspace.isDefault && !isSelected && (
        <span className="text-[9px] font-medium text-[#86868b] bg-[#f1f3f5] px-1.5 py-0.5 rounded-full shrink-0">
          Default
        </span>
      )}
    </button>
  );
}
