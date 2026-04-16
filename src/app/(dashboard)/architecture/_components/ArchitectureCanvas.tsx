"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeChange,
  applyNodeChanges,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ApplicationNode,
  APP_NODE_DEFAULT_H,
  APP_NODE_DEFAULT_W,
  type ApplicationNodeData,
} from "./ApplicationNode";
import {
  AnnotationNode,
  type AnnotationNodeData,
  type AnnotationNodeKind,
} from "./AnnotationNode";
import type { DiagramTool } from "./DiagramToolRail";
import {
  AnnotationEdgesLayer,
  type Anchor,
  type PendingLine,
  type Waypoint,
  pickHandleForPoint,
} from "./AnnotationEdgesLayer";

// ─── Types ─────────────────────────────────────────────────

export type DiagramApplication = {
  id: string;
  name: string;
  vendor: string | null;
  applicationType: string | null;
  lifecycle: string | null;
  businessValue: string | null;
  technicalHealth: string | null;
  systemLandscapeRole: string | null;
};

export type DiagramInterface = {
  id: string;
  sourceAppId: string;
  targetAppId: string;
  name: string;
  protocol: string;
  direction: string;
  criticality: string;
  reviewStatus: "PENDING" | "ACCEPTED" | "REJECTED";
  source: string;
  aiConfidence: number | null;
  dataFlows?: Array<{ entity: { id: string; name: string; domainId: string | null } }>;
};

export type DiagramAnnotation = {
  id: string;
  type: AnnotationNodeKind | "LINE" | "ARROW";
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  z: number;
  text: string | null;
  strokeColor: string | null;
  fillColor: string | null;
  strokeWidth: number | null;
  strokeStyle: string | null;
  headSource: boolean;
  headTarget: boolean;
  routing: string;
  sourceAnchor: unknown;
  targetAnchor: unknown;
  waypoints: unknown;
};

export type NodeSize = { w: number; h: number };

type Props = {
  apps: DiagramApplication[];
  interfaces: DiagramInterface[];
  annotations: DiagramAnnotation[];
  nodePositions: Record<string, { x: number; y: number }>;
  nodeSizes: Record<string, NodeSize>;
  defaultNodeW: number;
  defaultNodeH: number;
  showDataFlows: boolean;
  showPending: boolean;
  selectedEdgeId: string | null;
  selectedAnnotationId: string | null;
  activeTool: DiagramTool;
  onSelectEdge: (id: string | null) => void;
  onSelectNode?: (id: string | null) => void;
  onSelectAnnotation: (id: string | null) => void;
  onPositionsChange: (positions: Record<string, { x: number; y: number }>) => void;
  onSizesChange: (sizes: Record<string, NodeSize>) => void;
  onCreateAnnotationAt: (
    tool: DiagramTool,
    x: number,
    y: number
  ) => void;
  onAnnotationMove: (id: string, x: number, y: number) => void;
  onAnnotationResize: (id: string, w: number, h: number) => void;
  onAnnotationText: (id: string, text: string) => void;
  onCreateLine: (
    tool: "line" | "arrow",
    sourceAnchor: Anchor,
    targetAnchor: Anchor
  ) => void;
  onUpdateWaypoints: (id: string, waypoints: Waypoint[]) => void;
  onResetTool: () => void;
  snapToGrid?: boolean;
};

const nodeTypes: NodeTypes = { application: ApplicationNode, annotation: AnnotationNode };

// Auto-layout: simple grid when no saved positions
const GRID_COLS = 6;
const H_GAP = 220;
const V_GAP = 120;

function autoLayout(apps: DiagramApplication[]): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  apps.forEach((app, i) => {
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    out[app.id] = { x: col * H_GAP, y: row * V_GAP };
  });
  return out;
}

function pickHandles(
  src: { x: number; y: number },
  tgt: { x: number; y: number }
): { sourceHandle: string; targetHandle: string } {
  const dx = tgt.x - src.x;
  const dy = tgt.y - src.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { sourceHandle: "r", targetHandle: "l" };
  }
  return { sourceHandle: "b", targetHandle: "t" };
}

const CRITICALITY_COLOR: Record<string, string> = {
  INT_CRITICAL: "#e11d48",
  INT_HIGH: "#ea580c",
  INT_MEDIUM: "#2563eb",
  INT_LOW: "#6b7280",
};

const ANNOTATION_NODE_KINDS: readonly AnnotationNodeKind[] = [
  "CONTAINER",
  "NOTE",
  "RECTANGLE",
  "CIRCLE",
  "CYLINDER",
  "CLOUD",
];

function isAnnotationNodeKind(t: string): t is AnnotationNodeKind {
  return (ANNOTATION_NODE_KINDS as readonly string[]).includes(t);
}

export function ArchitectureCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <InnerCanvas {...props} />
    </ReactFlowProvider>
  );
}

function InnerCanvas({
  apps,
  interfaces,
  annotations,
  nodePositions,
  nodeSizes,
  defaultNodeW,
  defaultNodeH,
  showDataFlows,
  showPending,
  selectedEdgeId,
  selectedAnnotationId,
  activeTool,
  onSelectEdge,
  onSelectNode,
  onSelectAnnotation,
  onPositionsChange,
  onSizesChange,
  onCreateAnnotationAt,
  onAnnotationMove,
  onAnnotationResize,
  onAnnotationText,
  onCreateLine,
  onUpdateWaypoints,
  onResetTool,
  snapToGrid,
}: Props) {
  const positions = useMemo(
    () => ({ ...autoLayout(apps), ...nodePositions }),
    [apps, nodePositions]
  );

  // Application nodes
  const appNodes: Node[] = useMemo(
    () =>
      apps.map((a) => {
        const size = nodeSizes[a.id];
        const w = size?.w ?? defaultNodeW;
        const h = size?.h ?? defaultNodeH;
        return {
          id: a.id,
          type: "application",
          position: positions[a.id] ?? { x: 0, y: 0 },
          width: w,
          height: h,
          selected: false,
          style: { width: w, height: h },
          data: {
            name: a.name,
            vendor: a.vendor,
            applicationType: a.applicationType,
            lifecycle: a.lifecycle,
            businessValue: a.businessValue,
            technicalHealth: a.technicalHealth,
            systemLandscapeRole: a.systemLandscapeRole,
            width: w,
            height: h,
          } satisfies ApplicationNodeData,
        };
      }),
    [apps, positions, nodeSizes, defaultNodeW, defaultNodeH]
  );

  // Annotation nodes (rectangle/circle/note/etc.) — exclude LINE/ARROW (edges)
  const annotationNodes: Node[] = useMemo(
    () =>
      annotations
        .filter((a) => isAnnotationNodeKind(a.type))
        .map((a) => {
          const w = a.width ?? 200;
          const h = a.height ?? 120;
          return {
            id: `ann:${a.id}`,
            type: "annotation",
            position: { x: a.x, y: a.y },
            width: w,
            height: h,
            style: { width: w, height: h, zIndex: a.z },
            zIndex: a.z,
            selected: selectedAnnotationId === a.id,
            data: {
              kind: a.type as AnnotationNodeKind,
              text: a.text,
              strokeColor: a.strokeColor,
              fillColor: a.fillColor,
              strokeWidth: a.strokeWidth,
              strokeStyle: a.strokeStyle as "solid" | "dashed" | "dotted" | null,
              width: w,
              height: h,
              onTextCommit: (t: string) => onAnnotationText(a.id, t),
            } satisfies AnnotationNodeData,
          };
        }),
    [annotations, selectedAnnotationId, onAnnotationText]
  );

  const initialNodes: Node[] = useMemo(
    // Annotations first so they render below app nodes (z-order by position in array + zIndex)
    () => [...annotationNodes, ...appNodes],
    [annotationNodes, appNodes]
  );

  const visibleInterfaces = useMemo(
    () =>
      interfaces.filter((i) =>
        i.reviewStatus === "REJECTED"
          ? false
          : i.reviewStatus === "PENDING"
            ? showPending
            : true
      ),
    [interfaces, showPending]
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      visibleInterfaces.map((iface) => {
        const srcPos = positions[iface.sourceAppId] ?? { x: 0, y: 0 };
        const tgtPos = positions[iface.targetAppId] ?? { x: 0, y: 0 };
        const { sourceHandle, targetHandle } = pickHandles(srcPos, tgtPos);
        const isPending = iface.reviewStatus === "PENDING";
        const color = isPending
          ? "#a855f7"
          : CRITICALITY_COLOR[iface.criticality] ?? "#2563eb";
        const label = showDataFlows
          ? iface.dataFlows?.map((f) => f.entity.name).join(", ") || iface.name
          : undefined;

        return {
          id: iface.id,
          source: iface.sourceAppId,
          target: iface.targetAppId,
          sourceHandle,
          targetHandle,
          type: "smoothstep",
          pathOptions: { borderRadius: 0, offset: 20 } as any,
          animated: isPending,
          label,
          labelStyle: { fontSize: 11, fontWeight: 500 },
          labelBgStyle: { fill: "var(--card)", fillOpacity: 0.9 },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
          style: {
            stroke: color,
            strokeWidth: iface.id === selectedEdgeId ? 3 : 1.75,
            strokeDasharray: isPending ? "6 4" : undefined,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color,
            width: 14,
            height: 14,
          },
          data: { interfaceId: iface.id },
        } as Edge;
      }),
    [visibleInterfaces, positions, showDataFlows, selectedEdgeId]
  );

  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const posTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePosSave = useCallback(
    (next: Record<string, { x: number; y: number }>) => {
      if (posTimer.current) clearTimeout(posTimer.current);
      posTimer.current = setTimeout(() => onPositionsChange(next), 400);
    },
    [onPositionsChange]
  );

  const scheduleSizeSave = useCallback(
    (next: Record<string, NodeSize>) => {
      if (sizeTimer.current) clearTimeout(sizeTimer.current);
      sizeTimer.current = setTimeout(() => onSizesChange(next), 400);
    },
    [onSizesChange]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((current) => {
        const next = applyNodeChanges(changes, current);

        const dragEnded = changes.some(
          (c) => c.type === "position" && (c as any).dragging === false
        );
        if (dragEnded) {
          const appSnapshot: Record<string, { x: number; y: number }> = {};
          for (const n of next) {
            if (n.type === "application") {
              appSnapshot[n.id] = { x: n.position.x, y: n.position.y };
            } else if (n.type === "annotation" && n.id.startsWith("ann:")) {
              const annId = n.id.slice(4);
              // Immediate save for single annotation — debounce not critical
              onAnnotationMove(annId, n.position.x, n.position.y);
            }
          }
          if (Object.keys(appSnapshot).length) schedulePosSave(appSnapshot);
        }

        const dimensionChanged = changes.some(
          (c) => c.type === "dimensions" && (c as any).resizing === false
        );
        if (dimensionChanged) {
          const appSizes: Record<string, NodeSize> = {};
          for (const n of next) {
            const style = (n as any).style as { width?: number; height?: number } | undefined;
            const w = (n as any).width ?? style?.width;
            const h = (n as any).height ?? style?.height;
            if (typeof w !== "number" || typeof h !== "number") continue;

            if (n.type === "application") {
              appSizes[n.id] = { w: Math.round(w), h: Math.round(h) };
            } else if (n.type === "annotation" && n.id.startsWith("ann:")) {
              const annId = n.id.slice(4);
              onAnnotationResize(annId, Math.round(w), Math.round(h));
            }
          }
          if (Object.keys(appSizes).length) scheduleSizeSave(appSizes);
        }

        return next;
      });
    },
    [setNodes, schedulePosSave, scheduleSizeSave, onAnnotationMove, onAnnotationResize]
  );

  // Pending line creation state
  const [pendingLine, setPendingLine] = useState<PendingLine | null>(null);
  const flow = useReactFlow();

  // Reset pending line when tool changes away from line/arrow
  useEffect(() => {
    if (activeTool !== "line" && activeTool !== "arrow") setPendingLine(null);
  }, [activeTool]);

  // Esc cancels pending
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && pendingLine) {
        setPendingLine(null);
        onResetTool();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingLine, onResetTool]);

  // Build node lookup for anchor helpers
  const getNodeBounds = useCallback(
    (id: string): { x: number; y: number; w: number; h: number } | null => {
      const n = nodes.find((nn) => nn.id === id);
      if (!n) return null;
      const style = (n as any).style as { width?: number; height?: number } | undefined;
      const w = (n as any).width ?? style?.width ?? 120;
      const h = (n as any).height ?? style?.height ?? 60;
      return { x: n.position.x, y: n.position.y, w, h };
    },
    [nodes]
  );

  // Build an anchor from a click target
  const anchorFromNodeClick = useCallback(
    (node: Node, clickPoint: { x: number; y: number }): Anchor => {
      const bounds = getNodeBounds(node.id);
      if (!bounds) return { kind: "FREE", x: clickPoint.x, y: clickPoint.y };
      const handle = pickHandleForPoint(bounds, clickPoint);
      if (node.type === "annotation" && node.id.startsWith("ann:")) {
        return { kind: "ANNOTATION", refId: node.id.slice(4), handle };
      }
      return { kind: "APP", refId: node.id, handle };
    },
    [getNodeBounds]
  );

  // Pane click
  const onPaneClick = useCallback(
    (e: React.MouseEvent) => {
      const point = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });

      if (activeTool === "line" || activeTool === "arrow") {
        if (!pendingLine) {
          setPendingLine({
            tool: activeTool,
            sourceAnchor: { kind: "FREE", x: point.x, y: point.y },
            cursor: point,
          });
        } else {
          onCreateLine(activeTool, pendingLine.sourceAnchor, { kind: "FREE", x: point.x, y: point.y });
          setPendingLine(null);
          onResetTool();
        }
        return;
      }

      onSelectEdge(null);
      onSelectNode?.(null);
      onSelectAnnotation(null);
      if (activeTool === "select") return;
      onCreateAnnotationAt(activeTool, point.x, point.y);
      onResetTool();
    },
    [
      activeTool,
      flow,
      onCreateAnnotationAt,
      onCreateLine,
      onResetTool,
      onSelectAnnotation,
      onSelectEdge,
      onSelectNode,
      pendingLine,
    ]
  );

  const onNodeClick = useCallback(
    (e: React.MouseEvent, node: Node) => {
      if (activeTool === "line" || activeTool === "arrow") {
        const point = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const anchor = anchorFromNodeClick(node, point);
        if (!pendingLine) {
          setPendingLine({ tool: activeTool, sourceAnchor: anchor, cursor: point });
        } else {
          onCreateLine(activeTool, pendingLine.sourceAnchor, anchor);
          setPendingLine(null);
          onResetTool();
        }
        return;
      }
      if (node.type === "annotation" && node.id.startsWith("ann:")) {
        onSelectAnnotation(node.id.slice(4));
        onSelectEdge(null);
        onSelectNode?.(null);
      } else {
        onSelectNode?.(node.id);
        onSelectAnnotation(null);
      }
    },
    [
      activeTool,
      anchorFromNodeClick,
      flow,
      onCreateLine,
      onResetTool,
      onSelectAnnotation,
      onSelectEdge,
      onSelectNode,
      pendingLine,
    ]
  );

  // Track cursor for pending line preview
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!pendingLine) return;
      const point = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setPendingLine((p) => (p ? { ...p, cursor: point } : null));
    },
    [flow, pendingLine]
  );

  return (
    <div
      className="h-full w-full relative"
      style={{ cursor: activeTool === "select" ? "default" : "crosshair" }}
      onMouseMove={onMouseMove}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgeClick={(_, edge) => onSelectEdge(edge.id)}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        minZoom={0.1}
        maxZoom={2}
        snapToGrid={snapToGrid}
        snapGrid={[16, 16]}
        defaultEdgeOptions={{ type: "smoothstep" }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <Controls position="bottom-right" />
        <MiniMap
          pannable
          zoomable
          nodeStrokeWidth={2}
          className="!bg-card !border !border-border"
        />
        <AnnotationEdgesLayer
          annotations={annotations}
          pendingLine={pendingLine}
          selectedAnnotationId={selectedAnnotationId}
          onSelectAnnotation={onSelectAnnotation}
          onUpdateWaypoints={onUpdateWaypoints}
        />
      </ReactFlow>
    </div>
  );
}
