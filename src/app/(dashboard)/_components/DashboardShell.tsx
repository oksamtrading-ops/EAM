"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Network,
  Settings,
  Tags,
  Building2,
  AppWindow,
  Map,
  ShieldAlert,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";
import { CmdPaletteProvider } from "./CmdPaletteProvider";
import { SidebarSearchPill } from "./PageSearchTrigger";

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
    label: "Organization",
    href: "/organizations",
    icon: Building2,
  },
  {
    label: "Tags",
    href: "/tags",
    icon: Tags,
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <CmdPaletteProvider>
    <div className="flex h-screen overflow-hidden">
      {/* Mobile header bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-md border-b md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5 text-[#3a3a3c]" />
        </button>
        <span className="text-sm font-bold text-[#1a1f2e] truncate">
          {navItems.find((n) => pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href + "/")))?.label ?? "EAM"}
        </span>
      </div>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — glass panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[240px] flex flex-col glass-sidebar transition-transform duration-200 ease-in-out",
          "md:relative md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          background: "rgba(255, 255, 255, 0.92)",
          borderRight: "1px solid rgba(255, 255, 255, 0.30)",
          boxShadow: "1px 0 0 rgba(0,0,0,0.04), 4px 0 24px rgba(0,0,0,0.04)",
        }}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-3 right-3 p-1 rounded-lg hover:bg-black/5 transition-colors md:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4 text-[#86868b]" />
        </button>

        {/* Workspace Switcher */}
        <WorkspaceSwitcher onCreateNew={() => setShowCreate(true)} />

        {/* Search */}
        <SidebarSearchPill />

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
                    ? "bg-[#0B5CD6] text-white shadow-sm"
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
      <main className="flex-1 overflow-auto flex flex-col pt-[52px] md:pt-0">
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
