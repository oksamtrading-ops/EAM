"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeChange,
  applyNodeChanges,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ApplicationNode, type ApplicationNodeData } from "./ApplicationNode";

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

type Props = {
  apps: DiagramApplication[];
  interfaces: DiagramInterface[];
  nodePositions: Record<string, { x: number; y: number }>;
  showDataFlows: boolean;
  showPending: boolean;
  selectedEdgeId: string | null;
  onSelectEdge: (id: string | null) => void;
  onSelectNode?: (id: string | null) => void;
  onPositionsChange: (positions: Record<string, { x: number; y: number }>) => void;
};

const nodeTypes: NodeTypes = { application: ApplicationNode };

// Auto-layout: simple grid when no saved positions
const GRID_COLS = 5;
const H_GAP = 300;
const V_GAP = 160;

function autoLayout(apps: DiagramApplication[]): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  apps.forEach((app, i) => {
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    out[app.id] = { x: col * H_GAP, y: row * V_GAP };
  });
  return out;
}

// Pick source/target handles for 90° orthogonal routing based on relative
// position of the two nodes. We prefer horizontal (left/right) when the x
// delta is larger, vertical (top/bottom) otherwise.
function pickHandles(
  src: { x: number; y: number },
  tgt: { x: number; y: number }
): { sourceHandle: string; targetHandle: string } {
  const dx = tgt.x - src.x;
  const dy = tgt.y - src.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: "r", targetHandle: "l" }
      : { sourceHandle: "r", targetHandle: "l" };
    // Note: we only have r/l/t/b. If dx<0 we still go out right for a cleaner
    // L: but reversing to l/r looks worse in practice. Keeping r->l.
  }
  return dy >= 0
    ? { sourceHandle: "b", targetHandle: "t" }
    : { sourceHandle: "b", targetHandle: "t" };
}

const CRITICALITY_COLOR: Record<string, string> = {
  INT_CRITICAL: "#e11d48", // rose-600
  INT_HIGH: "#ea580c", // orange-600
  INT_MEDIUM: "#2563eb", // blue-600
  INT_LOW: "#6b7280", // zinc-500
};

export function ArchitectureCanvas({
  apps,
  interfaces,
  nodePositions,
  showDataFlows,
  showPending,
  selectedEdgeId,
  onSelectEdge,
  onSelectNode,
  onPositionsChange,
}: Props) {
  const positions = useMemo(() => {
    const merged = { ...autoLayout(apps), ...nodePositions };
    return merged;
  }, [apps, nodePositions]);

  const initialNodes: Node[] = useMemo(
    () =>
      apps.map((a) => ({
        id: a.id,
        type: "application",
        position: positions[a.id] ?? { x: 0, y: 0 },
        data: {
          name: a.name,
          vendor: a.vendor,
          applicationType: a.applicationType,
          lifecycle: a.lifecycle,
          businessValue: a.businessValue,
          technicalHealth: a.technicalHealth,
          systemLandscapeRole: a.systemLandscapeRole,
        } satisfies ApplicationNodeData,
      })),
    [apps, positions]
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
          ? "#a855f7" // purple for pending AI suggestions
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
          // borderRadius: 0 → hard 90° corners (L-shape).
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

  // Rebuild nodes/edges when inputs change.
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Debounced save of positions to server on drag stop.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSave = useCallback(
    (next: Record<string, { x: number; y: number }>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        onPositionsChange(next);
      }, 400);
    },
    [onPositionsChange]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((current) => {
        const next = applyNodeChanges(changes, current);
        // If any drag changes, persist.
        const anyDrag = changes.some(
          (c) => c.type === "position" && (c as any).dragging === false
        );
        if (anyDrag) {
          const snapshot: Record<string, { x: number; y: number }> = {};
          for (const n of next) snapshot[n.id] = { x: n.position.x, y: n.position.y };
          scheduleSave(snapshot);
        }
        return next;
      });
    },
    [setNodes, scheduleSave]
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgeClick={(_, edge) => onSelectEdge(edge.id)}
        onNodeClick={(_, node) => onSelectNode?.(node.id)}
        onPaneClick={() => {
          onSelectEdge(null);
          onSelectNode?.(null);
        }}
        fitView
        minZoom={0.1}
        maxZoom={2}
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
      </ReactFlow>
    </div>
  );
}
