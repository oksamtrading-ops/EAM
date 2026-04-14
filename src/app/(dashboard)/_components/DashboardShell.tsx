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
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";
import { CmdPaletteProvider } from "./CmdPaletteProvider";
import { SidebarSearchPill } from "./PageSearchTrigger";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Capabilities", href: "/capabilities", icon: Network },
  { label: "Applications", href: "/applications", icon: AppWindow },
  { label: "Roadmap", href: "/roadmap", icon: Map },
  { label: "Risk & Compliance", href: "/risk", icon: ShieldAlert },
  { label: "Organization", href: "/organizations", icon: Building2 },
  { label: "Tags", href: "/tags", icon: Tags },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showCreate, setShowCreate] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const [sidebarExpanded, setSidebarExpanded] = useState(false); // desktop expand

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const currentPage =
    navItems.find(
      (n) =>
        pathname === n.href ||
        (n.href !== "/" && pathname.startsWith(n.href + "/"))
    )?.label ?? "EAM";

  return (
    <CmdPaletteProvider>
      <div className="flex h-screen overflow-hidden">
        {/* ── Mobile header bar ── */}
        <div className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 h-[52px] bg-white/80 backdrop-blur-md border-b md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5 text-[#3a3a3c]" />
          </button>
          <span className="text-sm font-bold text-[#1a1f2e] truncate">
            {currentPage}
          </span>
        </div>

        {/* ── Mobile backdrop ── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ── */}
        <aside
          className={cn(
            // Base: dark sidebar, always vertical flex
            "flex flex-col shrink-0 z-50 transition-all duration-200 ease-in-out overflow-hidden",
            // Desktop: relative, icon-only (60px) or expanded (240px)
            "hidden md:flex md:relative",
            sidebarExpanded ? "md:w-[240px]" : "md:w-[60px]",
            // Mobile: fixed full-height drawer, always 240px
            sidebarOpen && "!flex fixed inset-y-0 left-0 w-[240px]"
          )}
          style={{
            background: "linear-gradient(180deg, #0a0e1a 0%, #111827 100%)",
          }}
        >
          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 transition-colors md:hidden z-10"
            aria-label="Close menu"
          >
            <X className="h-4 w-4 text-white/60" />
          </button>

          {/* Logo area */}
          <div
            className="h-14 flex items-center gap-2.5 px-4 shrink-0 cursor-pointer"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            onClick={() => {
              if (window.innerWidth >= 768) setSidebarExpanded((v) => !v);
            }}
          >
            <div className="h-8 w-8 rounded-lg bg-[#0B5CD6] flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <span
              className={cn(
                "text-white font-semibold text-sm whitespace-nowrap transition-opacity duration-150",
                sidebarExpanded || sidebarOpen ? "opacity-100" : "opacity-0 md:hidden"
              )}
            >
              EAM Platform
            </span>
          </div>

          {/* Workspace switcher (expanded/mobile only) */}
          {(sidebarExpanded || sidebarOpen) && (
            <div className="sidebar-expanded-content">
              <WorkspaceSwitcher onCreateNew={() => setShowCreate(true)} />
              <SidebarSearchPill />
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
            {(sidebarExpanded || sidebarOpen) && (
              <p className="px-3 mb-2 mt-1 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                Modules
              </p>
            )}
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href + "/"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={!sidebarExpanded && !sidebarOpen ? item.label : undefined}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-xl text-[13px] font-medium transition-all group",
                    sidebarExpanded || sidebarOpen
                      ? "px-3 py-2.5"
                      : "px-0 py-2.5 justify-center",
                    isActive
                      ? "bg-[#0B5CD6] text-white shadow-sm"
                      : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-white rounded-r-full" />
                  )}
                  <item.icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0",
                      isActive ? "text-white" : "text-white/50"
                    )}
                  />
                  {(sidebarExpanded || sidebarOpen) && (
                    <span className="whitespace-nowrap">{item.label}</span>
                  )}
                  {/* Tooltip for collapsed state */}
                  {!sidebarExpanded && !sidebarOpen && (
                    <span className="absolute left-[56px] top-1/2 -translate-y-1/2 hidden group-hover:block bg-[#1a1f2e] text-white text-xs px-2.5 py-1 rounded-md whitespace-nowrap z-[100] shadow-lg pointer-events-none">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div
            className={cn(
              "flex items-center gap-3 px-4 py-3",
              !sidebarExpanded && !sidebarOpen && "justify-center px-0"
            )}
            style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
          >
            <UserButton
              appearance={{
                elements: { avatarBox: "h-8 w-8 rounded-xl" },
              }}
            />
            {(sidebarExpanded || sidebarOpen) && (
              <p className="text-xs text-white/40 truncate">Signed in</p>
            )}
          </div>

          {/* Desktop expand/collapse toggle */}
          <button
            onClick={() => setSidebarExpanded((v) => !v)}
            className={cn(
              "hidden md:flex items-center gap-2 py-3 text-white/30 hover:text-white/60 transition-colors cursor-pointer",
              sidebarExpanded ? "px-4" : "justify-center"
            )}
            style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
          >
            {sidebarExpanded ? (
              <>
                <ChevronsLeft className="h-4 w-4" />
                <span className="text-xs">Collapse</span>
              </>
            ) : (
              <ChevronsRight className="h-4 w-4" />
            )}
          </button>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-auto flex flex-col pt-[52px] md:pt-0 min-w-0">
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
