"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Network,
  Settings,
  Tags,
  Building2,
  Briefcase,
  AppWindow,
  Map,
  ShieldAlert,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";
import { CmdPaletteProvider } from "./CmdPaletteProvider";
import { CmdSearchPill } from "./CmdSearchPill";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Capabilities",
    href: "/capabilities",
    icon: Network,
  },
  {
    label: "Applications",
    href: "/applications",
    icon: AppWindow,
  },
  {
    label: "Roadmap",
    href: "/roadmap",
    icon: Map,
  },
  {
    label: "Risk & Compliance",
    href: "/risk",
    icon: ShieldAlert,
  },
  {
    label: "Organizations",
    href: "/organizations",
    icon: Building2,
  },
  {
    label: "Tags",
    href: "/tags",
    icon: Tags,
  },
  {
    label: "Organization Profile",
    href: "/settings/organization-profile",
    icon: Briefcase,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <CmdPaletteProvider>
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — glass panel */}
      <aside
        className="w-[240px] shrink-0 flex flex-col glass-sidebar"
        style={{
          background: "rgba(255, 255, 255, 0.65)",
          borderRight: "1px solid rgba(255, 255, 255, 0.30)",
          boxShadow: "1px 0 0 rgba(0,0,0,0.04), 4px 0 24px rgba(0,0,0,0.04)",
        }}
      >
        {/* Workspace Switcher */}
        <WorkspaceSwitcher onCreateNew={() => setShowCreate(true)} />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">
          <p className="px-3 mb-2 mt-1 text-[10px] font-semibold uppercase tracking-widest text-[#86868b]">
            Modules
          </p>
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-bold transition-all",
                  isActive
                    ? "bg-[#86BC25] text-white shadow-sm"
                    : "text-[#3a3a3c] hover:bg-black/[0.05] hover:text-[#1d1d1f]"
                )}
              >
                <item.icon
                  className={cn(
                    "h-[17px] w-[17px] shrink-0",
                    isActive ? "text-white" : "text-[#86868b]"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div
          className="px-4 py-4 flex items-center gap-3"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
        >
          <UserButton
            appearance={{
              elements: { avatarBox: "h-8 w-8 rounded-xl" },
            }}
          />
          <p className="text-xs text-[#86868b] truncate">Signed in</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col">
        <div className="flex items-center justify-end gap-3 px-6 py-3 border-b border-black/[0.05] bg-white/40 backdrop-blur-sm">
          <CmdSearchPill />
        </div>
        <div className="flex-1 overflow-auto">{children}</div>
      </main>

      {/* Create workspace dialog */}
      <CreateWorkspaceDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </div>
    </CmdPaletteProvider>
  );
}
