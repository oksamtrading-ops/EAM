"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Workflow,
  Sparkles,
  Eye,
  EyeOff,
  Database,
  Inbox,
  Download,
  Network,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OverflowMenu, type OverflowAction } from "@/components/shared/OverflowMenu";
import { ArchitectureCanvas, type DiagramApplication, type DiagramInterface } from "./ArchitectureCanvas";
import { InterfaceDetailPanel } from "./InterfaceDetailPanel";
import { ReviewQueuePanel } from "./ReviewQueuePanel";
import { exportDiagram } from "./export";

type Scenario = "AS_IS" | "TO_BE";

type Props = { scenario: Scenario };

export function ArchitectureDiagramClient({ scenario }: Props) {
  const [showDataFlows, setShowDataFlows] = useState(false);
  const [showPending, setShowPending] = useState(true);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { workspaceId } = useWorkspace();

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.diagram.getDiagramData.useQuery({
    scenario,
    includeDataFlows: showDataFlows,
  });

  const saveLayout = trpc.diagram.saveLayout.useMutation();

  const apps: DiagramApplication[] = useMemo(
    () =>
      (data?.apps ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        vendor: a.vendor,
        applicationType: a.applicationType,
        lifecycle: a.lifecycle,
        businessValue: a.businessValue,
        technicalHealth: a.technicalHealth,
        systemLandscapeRole: a.systemLandscapeRole,
      })),
    [data]
  );

  const interfaces: DiagramInterface[] = useMemo(
    () =>
      (data?.interfaces ?? []).map((i: any) => ({
        id: i.id,
        sourceAppId: i.sourceAppId,
        targetAppId: i.targetAppId,
        name: i.name,
        protocol: i.protocol,
        direction: i.direction,
        criticality: i.criticality,
        reviewStatus: i.reviewStatus,
        source: i.source,
        aiConfidence: i.aiConfidence,
        dataFlows: i.dataFlows,
      })),
    [data]
  );

  const pendingCount = interfaces.filter((i) => i.reviewStatus === "PENDING").length;

  const nodePositions =
    (data?.layout?.nodePositions as Record<string, { x: number; y: number }>) ?? {};

  const selectedInterface = useMemo(
    () => interfaces.find((i) => i.id === selectedEdgeId) ?? null,
    [interfaces, selectedEdgeId]
  );

  async function handleDiscover() {
    setAiRunning(true);
    try {
      const res = await fetch("/api/ai/architecture-discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "global", scenario }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "AI discovery failed");
        throw new Error(msg || "AI discovery failed");
      }
      const json = await res.json();
      toast.success(
        `AI discovered ${json.suggestionsGenerated ?? 0} integration${json.suggestionsGenerated === 1 ? "" : "s"} — review in queue`
      );
      await utils.diagram.getDiagramData.invalidate();
      await utils.diagram.listPendingSuggestions.invalidate();
      setReviewOpen(true);
    } catch (e: any) {
      toast.error(e.message ?? "AI discovery failed");
    } finally {
      setAiRunning(false);
    }
  }

  async function handleExport(format: "png" | "svg" | "pptx" | "csv") {
    if (exporting) return;
    setExporting(true);
    try {
      await exportDiagram({
        format,
        scenario,
        workspaceId: workspaceId ?? undefined,
        canvasEl: canvasRef.current,
        interfaces,
        apps,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  }

  function handlePositionsChange(positions: Record<string, { x: number; y: number }>) {
    saveLayout.mutate(
      { scenario, nodePositions: positions },
      {
        onError: (e) => toast.error(`Save layout failed: ${e.message}`),
      }
    );
  }

  const overflowActions: OverflowAction[] = [
    {
      label: showDataFlows ? "Hide data flows" : "Show data flows",
      icon: <Database className="h-4 w-4" />,
      onClick: () => setShowDataFlows((v) => !v),
      active: showDataFlows,
    },
    {
      label: showPending ? "Hide pending" : "Show pending",
      icon: showPending ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />,
      onClick: () => setShowPending((v) => !v),
    },
    {
      label: pendingCount > 0 ? `Review queue (${pendingCount})` : "Review queue",
      icon: <Inbox className="h-4 w-4" />,
      onClick: () => setReviewOpen(true),
    },
    {
      label: "Export",
      icon: <Download className="h-4 w-4" />,
      onClick: () => handleExport("png"),
    },
    {
      label: aiRunning ? "Discovering..." : "AI Discover",
      icon: <Sparkles className="h-4 w-4" />,
      onClick: handleDiscover,
      active: aiRunning,
    },
  ];

  return (
    <div className="h-[calc(100vh-52px)] md:h-screen flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b glass-toolbar">
        <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Workflow className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-md font-semibold text-foreground truncate">
                Architecture Diagram
              </h1>
              <p className="text-xs text-muted-foreground">
                {apps.length} apps · {interfaces.filter((i) => i.reviewStatus === "ACCEPTED").length} integrations
                {pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Scenario toggle */}
            <div className="flex bg-muted/40 rounded-lg p-0.5">
              <Link
                href="/architecture/as-is"
                className={cn(
                  "flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  scenario === "AS_IS"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                As-Is
              </Link>
              <Link
                href="/architecture/to-be"
                className={cn(
                  "flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  scenario === "TO_BE"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                To-Be
              </Link>
            </div>

            {/* Icon buttons — hidden below lg */}
            <div className="hidden lg:flex items-center gap-1">
              <div className="w-px h-6 bg-border mx-1" />

              <button
                onClick={() => setShowDataFlows((v) => !v)}
                title={showDataFlows ? "Hide data flows" : "Show data flows"}
                className={cn(
                  "relative group flex items-center justify-center w-8 h-8 rounded-lg border transition-all",
                  showDataFlows
                    ? "bg-primary/10 text-primary border-primary/40"
                    : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Database className="h-[15px] w-[15px]" />
                <Tip>{showDataFlows ? "Hide data flows" : "Show data flows"}</Tip>
              </button>

              <button
                onClick={() => setShowPending((v) => !v)}
                title={showPending ? "Hide pending" : "Show pending"}
                className="relative group flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all"
              >
                {showPending ? (
                  <Eye className="h-[15px] w-[15px]" />
                ) : (
                  <EyeOff className="h-[15px] w-[15px]" />
                )}
                <Tip>{showPending ? "Hide pending" : "Show pending"}</Tip>
              </button>

              <button
                onClick={() => setReviewOpen(true)}
                title="Review queue"
                className="relative group flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all"
              >
                <Inbox className="h-[15px] w-[15px]" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--ai)] text-white text-[9px] font-bold flex items-center justify-center">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
                <Tip>Review queue</Tip>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={exporting}
                  title={exporting ? "Exporting..." : "Export"}
                  className="relative group flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all disabled:opacity-50"
                >
                  <Download className="h-[15px] w-[15px]" />
                  <Tip>{exporting ? "Exporting..." : "Export"}</Tip>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("png")}>
                    PNG image
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("svg")}>
                    SVG vector
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("pptx")}>
                    PowerPoint (.pptx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("csv")}>
                    CSV (integrations)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                onClick={handleDiscover}
                disabled={aiRunning}
                title={aiRunning ? "Discovering..." : "AI Discover"}
                className="relative group flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--ai)]/30 text-[var(--ai)] hover:bg-[var(--ai-subtle)] transition-all disabled:opacity-50"
              >
                <Sparkles className="h-[15px] w-[15px]" />
                <Tip>{aiRunning ? "Discovering..." : "AI Discover"}</Tip>
              </button>
            </div>

            {/* Overflow menu — visible below lg */}
            <OverflowMenu actions={overflowActions} className="lg:hidden" />
          </div>
        </div>
      </div>

      {/* Body: canvas + optional detail panel */}
      <div className="flex-1 flex min-h-0">
        <div ref={canvasRef} className="flex-1 min-w-0 bg-muted/20">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading diagram...
            </div>
          ) : apps.length === 0 ? (
            <EmptyState />
          ) : (
            <ArchitectureCanvas
              apps={apps}
              interfaces={interfaces}
              nodePositions={nodePositions}
              showDataFlows={showDataFlows}
              showPending={showPending}
              selectedEdgeId={selectedEdgeId}
              onSelectEdge={setSelectedEdgeId}
              onPositionsChange={handlePositionsChange}
            />
          )}
        </div>

        {selectedInterface && (
          <InterfaceDetailPanel
            interface={selectedInterface}
            apps={apps}
            onClose={() => setSelectedEdgeId(null)}
            scenario={scenario}
          />
        )}
      </div>

      {reviewOpen && (
        <ReviewQueuePanel
          scenario={scenario}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block bg-foreground text-background text-[11px] px-2 py-1 rounded-md whitespace-nowrap z-[100] pointer-events-none shadow-lg">
      {children}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
      <Network className="h-10 w-10 text-muted-foreground" />
      <div>
        <p className="font-medium">No applications yet</p>
        <p className="text-sm text-muted-foreground max-w-md">
          Add applications in the Applications module, then come back here to visualize
          integrations — or click "AI Discover" once you have apps.
        </p>
      </div>
      <Link href="/applications">
        <Button variant="outline" size="sm">
          Go to Applications
        </Button>
      </Link>
    </div>
  );
}
