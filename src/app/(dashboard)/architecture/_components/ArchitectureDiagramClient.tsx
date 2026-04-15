"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="h-[calc(100vh-52px)] md:h-screen flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Architecture Diagram</h1>
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg border p-0.5 text-sm bg-muted/40">
          <Link
            href="/architecture/as-is"
            className={cn(
              "px-3 py-1 rounded-md transition-colors",
              scenario === "AS_IS"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            As-Is
          </Link>
          <Link
            href="/architecture/to-be"
            className={cn(
              "px-3 py-1 rounded-md transition-colors",
              scenario === "TO_BE"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            To-Be
          </Link>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDataFlows((v) => !v)}
            title="Toggle data-flow labels on edges"
          >
            <Database className="h-4 w-4" />
            {showDataFlows ? "Hide data flows" : "Show data flows"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPending((v) => !v)}
            title="Toggle visibility of pending AI suggestions"
          >
            {showPending ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {showPending ? "Hide pending" : "Show pending"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReviewOpen(true)}
            className="relative"
          >
            <Inbox className="h-4 w-4" />
            Review queue
            {pendingCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 min-w-[20px] justify-center px-1.5 text-[10px]"
              >
                {pendingCount}
              </Badge>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={exporting}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm font-medium bg-background hover:bg-muted/60 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Exporting..." : "Export"}
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
          <Button size="sm" onClick={handleDiscover} disabled={aiRunning}>
            <Sparkles className="h-4 w-4" />
            {aiRunning ? "Discovering..." : "AI Discover"}
          </Button>
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
