"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  Maximize2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OverflowMenu, type OverflowAction } from "@/components/shared/OverflowMenu";
import {
  ArchitectureCanvas,
  type DiagramApplication,
  type DiagramInterface,
  type DiagramAnnotation,
  type NodeSize,
} from "./ArchitectureCanvas";
import {
  APP_NODE_DEFAULT_H,
  APP_NODE_DEFAULT_W,
} from "./ApplicationNode";
import { DiagramToolRail, type DiagramTool } from "./DiagramToolRail";
import type { Anchor, Waypoint } from "./AnnotationEdgesLayer";
import { useDiagramKeyboard } from "./useDiagramKeyboard";
import { Grid3x3 } from "lucide-react";
import {
  AnnotationPropertiesPanel,
  type AnnotationPatch,
  type SelectedAnnotation,
} from "./AnnotationPropertiesPanel";
import { InterfaceDetailPanel } from "./InterfaceDetailPanel";
import { ReviewQueuePanel } from "./ReviewQueuePanel";
import { exportDiagram } from "./export";

type Scenario = "AS_IS" | "TO_BE";

type Props = { scenario: Scenario };

// Default sizes for newly created annotations, keyed by tool.
const ANNOTATION_DEFAULTS: Record<
  string,
  { type: "CONTAINER" | "NOTE" | "RECTANGLE" | "CIRCLE" | "CYLINDER" | "CLOUD"; w: number; h: number; text: string }
> = {
  container: { type: "CONTAINER", w: 320, h: 200, text: "" },
  note: { type: "NOTE", w: 180, h: 100, text: "" },
  "shape:rectangle": { type: "RECTANGLE", w: 160, h: 80, text: "" },
  "shape:circle": { type: "CIRCLE", w: 120, h: 120, text: "" },
  "shape:cylinder": { type: "CYLINDER", w: 140, h: 100, text: "" },
  "shape:cloud": { type: "CLOUD", w: 160, h: 110, text: "" },
};

export function ArchitectureDiagramClient({ scenario }: Props) {
  const [showDataFlows, setShowDataFlows] = useState(false);
  const [showPending, setShowPending] = useState(true);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<DiagramTool>("select");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  // In-session undo/redo for annotation mutations only
  const undoStack = useRef<Array<() => void>>([]);
  const redoStack = useRef<Array<() => void>>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { workspaceId } = useWorkspace();

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.diagram.getDiagramData.useQuery({
    scenario,
    includeDataFlows: showDataFlows,
  });
  const { data: annotationData } = trpc.diagramAnnotation.list.useQuery({ scenario });

  const saveLayout = trpc.diagram.saveLayout.useMutation();
  const createAnnotation = trpc.diagramAnnotation.create.useMutation({
    onSuccess: () => utils.diagramAnnotation.list.invalidate({ scenario }),
    onError: (e) => toast.error(`Create annotation failed: ${e.message}`),
  });
  const updateAnnotation = trpc.diagramAnnotation.update.useMutation({
    onSuccess: () => utils.diagramAnnotation.list.invalidate({ scenario }),
    onError: (e) => toast.error(`Update annotation failed: ${e.message}`),
  });
  const deleteAnnotation = trpc.diagramAnnotation.delete.useMutation({
    onSuccess: () => utils.diagramAnnotation.list.invalidate({ scenario }),
    onError: (e) => toast.error(`Delete annotation failed: ${e.message}`),
  });

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

  const annotations: DiagramAnnotation[] = useMemo(
    () =>
      (annotationData ?? []).map((a: any) => ({
        id: a.id,
        type: a.type,
        x: a.x,
        y: a.y,
        width: a.width,
        height: a.height,
        z: a.z,
        text: a.text,
        strokeColor: a.strokeColor,
        fillColor: a.fillColor,
        strokeWidth: a.strokeWidth,
        strokeStyle: a.strokeStyle,
        headSource: a.headSource,
        headTarget: a.headTarget,
        routing: a.routing,
        sourceAnchor: a.sourceAnchor,
        targetAnchor: a.targetAnchor,
        waypoints: a.waypoints,
      })),
    [annotationData]
  );

  const pendingCount = interfaces.filter((i) => i.reviewStatus === "PENDING").length;

  const nodePositions =
    (data?.layout?.nodePositions as Record<string, { x: number; y: number }>) ?? {};
  const nodeSizes = (data?.layout?.nodeSizes as Record<string, NodeSize>) ?? {};
  const savedDefaultW = data?.layout?.defaultNodeW ?? null;
  const savedDefaultH = data?.layout?.defaultNodeH ?? null;
  const defaultNodeW = savedDefaultW ?? APP_NODE_DEFAULT_W;
  const defaultNodeH = savedDefaultH ?? APP_NODE_DEFAULT_H;

  const selectedInterface = useMemo(
    () => interfaces.find((i) => i.id === selectedEdgeId) ?? null,
    [interfaces, selectedEdgeId]
  );

  const selectedAnnotation: SelectedAnnotation | null = useMemo(() => {
    if (!selectedAnnotationId) return null;
    const a = annotations.find((x) => x.id === selectedAnnotationId);
    if (!a) return null;
    return {
      id: a.id,
      type: a.type,
      text: a.text,
      strokeColor: a.strokeColor,
      fillColor: a.fillColor,
      strokeWidth: a.strokeWidth,
      strokeStyle: a.strokeStyle,
      z: a.z,
    };
  }, [annotations, selectedAnnotationId]);

  // ─── Handlers ──────────────────────────────────────────────
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

  const handlePositionsChange = useCallback(
    (positions: Record<string, { x: number; y: number }>) => {
      saveLayout.mutate(
        { scenario, nodePositions: positions },
        { onError: (e) => toast.error(`Save layout failed: ${e.message}`) }
      );
    },
    [saveLayout, scenario]
  );

  const handleSizesChange = useCallback(
    (sizes: Record<string, NodeSize>) => {
      saveLayout.mutate(
        { scenario, nodeSizes: sizes },
        { onError: (e) => toast.error(`Save sizes failed: ${e.message}`) }
      );
    },
    [saveLayout, scenario]
  );

  function handleDefaultSizeChange(w: number, h: number) {
    saveLayout.mutate(
      { scenario, defaultNodeW: w, defaultNodeH: h },
      {
        onSuccess: () => utils.diagram.getDiagramData.invalidate(),
        onError: (e) => toast.error(`Save default size failed: ${e.message}`),
      }
    );
  }

  const handleCreateAnnotationAt = useCallback(
    (tool: DiagramTool, x: number, y: number) => {
      if (tool === "select" || tool === "line" || tool === "arrow") return;
      const def = ANNOTATION_DEFAULTS[tool];
      if (!def) return;
      const highestZ = annotations.reduce((m, a) => Math.max(m, a.z), 0);
      createAnnotation.mutate(
        {
          scenario,
          type: def.type,
          x: x - def.w / 2,
          y: y - def.h / 2,
          width: def.w,
          height: def.h,
          z: highestZ + 1,
          text: def.text,
        },
        {
          onSuccess: (created) => setSelectedAnnotationId(created.id),
        }
      );
    },
    [annotations, createAnnotation, scenario]
  );

  const handleCreateLine = useCallback(
    (tool: "line" | "arrow", sourceAnchor: Anchor, targetAnchor: Anchor) => {
      const highestZ = annotations.reduce((m, a) => Math.max(m, a.z), 0);
      createAnnotation.mutate(
        {
          scenario,
          type: tool === "arrow" ? "ARROW" : "LINE",
          x: 0,
          y: 0,
          z: highestZ + 1,
          sourceAnchor: sourceAnchor as any,
          targetAnchor: targetAnchor as any,
          waypoints: [],
          routing: "orthogonal",
          headTarget: tool === "arrow",
          headSource: false,
        },
        {
          onSuccess: (created) => setSelectedAnnotationId(created.id),
        }
      );
    },
    [annotations, createAnnotation, scenario]
  );

  const handleUpdateWaypoints = useCallback(
    (id: string, waypoints: Waypoint[]) => {
      updateAnnotation.mutate({ id, patch: { waypoints } as any });
    },
    [updateAnnotation]
  );

  const handleAnnotationMove = useCallback(
    (id: string, x: number, y: number) => {
      updateAnnotation.mutate({ id, patch: { x, y } as any });
    },
    [updateAnnotation]
  );

  const handleAnnotationResize = useCallback(
    (id: string, w: number, h: number) => {
      updateAnnotation.mutate({ id, patch: { width: w, height: h } as any });
    },
    [updateAnnotation]
  );

  const handleAnnotationText = useCallback(
    (id: string, text: string) => {
      updateAnnotation.mutate({ id, patch: { text: text || null } });
    },
    [updateAnnotation]
  );

  const handleAnnotationPatch = useCallback(
    (patch: AnnotationPatch) => {
      if (!selectedAnnotationId) return;
      updateAnnotation.mutate({ id: selectedAnnotationId, patch });
    },
    [selectedAnnotationId, updateAnnotation]
  );

  const handleAnnotationDelete = useCallback(() => {
    if (!selectedAnnotationId) return;
    const existing = annotations.find((a) => a.id === selectedAnnotationId);
    deleteAnnotation.mutate({ id: selectedAnnotationId });
    setSelectedAnnotationId(null);
    // Push undo: recreate
    if (existing) {
      const recreate = () => {
        createAnnotation.mutate({
          scenario,
          type: existing.type as any,
          x: existing.x,
          y: existing.y,
          width: existing.width,
          height: existing.height,
          z: existing.z,
          text: existing.text,
          strokeColor: existing.strokeColor,
          fillColor: existing.fillColor,
          strokeWidth: existing.strokeWidth,
          strokeStyle: existing.strokeStyle as any,
          sourceAnchor: existing.sourceAnchor as any,
          targetAnchor: existing.targetAnchor as any,
          waypoints: (existing.waypoints as any) ?? [],
          routing: existing.routing as any,
          headSource: existing.headSource,
          headTarget: existing.headTarget,
        });
      };
      undoStack.current.push(recreate);
      redoStack.current = [];
    }
  }, [annotations, createAnnotation, deleteAnnotation, scenario, selectedAnnotationId]);

  const handleAnnotationDuplicate = useCallback(() => {
    if (!selectedAnnotationId) return;
    const existing = annotations.find((a) => a.id === selectedAnnotationId);
    if (!existing) return;
    createAnnotation.mutate(
      {
        scenario,
        type: existing.type as any,
        x: existing.x + 16,
        y: existing.y + 16,
        width: existing.width,
        height: existing.height,
        z: existing.z + 1,
        text: existing.text,
        strokeColor: existing.strokeColor,
        fillColor: existing.fillColor,
        strokeWidth: existing.strokeWidth,
        strokeStyle: existing.strokeStyle as any,
        sourceAnchor: existing.sourceAnchor as any,
        targetAnchor: existing.targetAnchor as any,
        waypoints: (existing.waypoints as any) ?? [],
        routing: existing.routing as any,
        headSource: existing.headSource,
        headTarget: existing.headTarget,
      },
      {
        onSuccess: (created) => {
          setSelectedAnnotationId(created.id);
          // Undo: delete the duplicate
          undoStack.current.push(() => deleteAnnotation.mutate({ id: created.id }));
          redoStack.current = [];
        },
      }
    );
  }, [annotations, createAnnotation, deleteAnnotation, scenario, selectedAnnotationId]);

  const handleUndo = useCallback(() => {
    const op = undoStack.current.pop();
    if (!op) {
      toast.info("Nothing to undo");
      return;
    }
    op();
  }, []);

  const handleRedo = useCallback(() => {
    const op = redoStack.current.pop();
    if (!op) {
      toast.info("Nothing to redo");
      return;
    }
    op();
  }, []);

  useDiagramKeyboard({
    selectedAnnotationId,
    onToolChange: setActiveTool,
    onDeleteAnnotation: handleAnnotationDelete,
    onDuplicateAnnotation: handleAnnotationDuplicate,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onDeselect: () => {
      setSelectedAnnotationId(null);
      setSelectedEdgeId(null);
    },
    onToggleSnap: () => setSnapToGrid((v) => !v),
  });

  const handleBringForward = useCallback(() => {
    if (!selectedAnnotationId || !selectedAnnotation) return;
    const maxZ = annotations.reduce((m, a) => Math.max(m, a.z), 0);
    updateAnnotation.mutate({ id: selectedAnnotationId, patch: { z: maxZ + 1 } });
  }, [annotations, selectedAnnotation, selectedAnnotationId, updateAnnotation]);

  const handleSendBackward = useCallback(() => {
    if (!selectedAnnotationId || !selectedAnnotation) return;
    const minZ = annotations.reduce((m, a) => Math.min(m, a.z), 0);
    updateAnnotation.mutate({ id: selectedAnnotationId, patch: { z: minZ - 1 } });
  }, [annotations, selectedAnnotation, selectedAnnotationId, updateAnnotation]);

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
                onClick={() => setSnapToGrid((v) => !v)}
                title={snapToGrid ? "Snap to grid: on" : "Snap to grid: off"}
                className={cn(
                  "relative group flex items-center justify-center w-8 h-8 rounded-lg border transition-all",
                  snapToGrid
                    ? "bg-primary/10 text-primary border-primary/40"
                    : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Grid3x3 className="h-[15px] w-[15px]" />
                <Tip>{snapToGrid ? "Snap: on" : "Snap to grid"}</Tip>
              </button>

              <NodeSizePopover
                width={defaultNodeW}
                height={defaultNodeH}
                onChange={handleDefaultSizeChange}
              />

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

            <OverflowMenu actions={overflowActions} className="lg:hidden" />
          </div>
        </div>
      </div>

      {/* Body: tool rail + canvas + optional detail panel */}
      <div className="flex-1 flex min-h-0">
        {apps.length > 0 && (
          <DiagramToolRail activeTool={activeTool} onSelectTool={setActiveTool} />
        )}

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
              annotations={annotations}
              nodePositions={nodePositions}
              nodeSizes={nodeSizes}
              defaultNodeW={defaultNodeW}
              defaultNodeH={defaultNodeH}
              showDataFlows={showDataFlows}
              showPending={showPending}
              selectedEdgeId={selectedEdgeId}
              selectedAnnotationId={selectedAnnotationId}
              activeTool={activeTool}
              onSelectEdge={setSelectedEdgeId}
              onSelectAnnotation={setSelectedAnnotationId}
              onPositionsChange={handlePositionsChange}
              onSizesChange={handleSizesChange}
              onCreateAnnotationAt={handleCreateAnnotationAt}
              onAnnotationMove={handleAnnotationMove}
              onAnnotationResize={handleAnnotationResize}
              onAnnotationText={handleAnnotationText}
              onCreateLine={handleCreateLine}
              onUpdateWaypoints={handleUpdateWaypoints}
              onResetTool={() => setActiveTool("select")}
              snapToGrid={snapToGrid}
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

        {selectedAnnotation && !selectedInterface && (
          <AnnotationPropertiesPanel
            annotation={selectedAnnotation}
            onClose={() => setSelectedAnnotationId(null)}
            onPatch={handleAnnotationPatch}
            onDelete={handleAnnotationDelete}
            onBringForward={handleBringForward}
            onSendBackward={handleSendBackward}
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

function NodeSizePopover({
  width,
  height,
  onChange,
}: {
  width: number;
  height: number;
  onChange: (w: number, h: number) => void;
}) {
  const [localW, setLocalW] = useState(width);
  const [localH, setLocalH] = useState(height);
  const [open, setOpen] = useState(false);

  function handleOpenChange(o: boolean) {
    if (o) {
      setLocalW(width);
      setLocalH(height);
    }
    setOpen(o);
  }

  function commit(w: number, h: number) {
    if (w !== width || h !== height) onChange(w, h);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        title="Default node size"
        className="relative group flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all"
      >
        <Maximize2 className="h-[15px] w-[15px]" />
        <Tip>Default node size</Tip>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium">Width</span>
              <span className="text-xs text-muted-foreground tabular-nums">{localW}px</span>
            </div>
            <Slider
              min={100}
              max={360}
              step={10}
              value={localW}
              onValueChange={(v) => setLocalW(Array.isArray(v) ? v[0]! : (v as number))}
              onValueCommitted={(v) => {
                const next = Array.isArray(v) ? v[0]! : (v as number);
                commit(next, localH);
              }}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium">Height</span>
              <span className="text-xs text-muted-foreground tabular-nums">{localH}px</span>
            </div>
            <Slider
              min={40}
              max={200}
              step={4}
              value={localH}
              onValueChange={(v) => setLocalH(Array.isArray(v) ? v[0]! : (v as number))}
              onValueCommitted={(v) => {
                const next = Array.isArray(v) ? v[0]! : (v as number);
                commit(localW, next);
              }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Applies to nodes without custom size. Resize individual nodes by selecting and
            dragging their handles.
          </p>
        </div>
      </PopoverContent>
    </Popover>
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
