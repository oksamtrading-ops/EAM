"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  type Connection,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Trash2, X } from "lucide-react";
import { useRoadmapContext } from "../RoadmapContext";
import { RAGStatusDot } from "../shared/RAGStatusDot";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#d1d5db",
  PLANNED: "#60a5fa",
  IN_PROGRESS: "#22c55e",
  ON_HOLD: "#facc15",
  COMPLETE: "#15803d",
  CANCELLED: "#9ca3af",
};

function InitiativeFlowNode({ data }: { data: { initiative: any } }) {
  const { initiative } = data;
  return (
    <div
      className={`px-3 py-2 rounded-lg border-2 bg-white shadow-sm min-w-[160px] text-center text-xs
        ${initiative.status === "BLOCKED" ? "border-red-400" : "border-blue-200"}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <RAGStatusDot status={initiative.ragStatus} />
        <p className="font-semibold truncate max-w-[130px]">{initiative.name}</p>
      </div>
      <p className="text-muted-foreground text-[10px]">{initiative.status.replace("_", " ")}</p>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { initiativeNode: InitiativeFlowNode };

type SelectedEdge = { id: string; source: string; target: string; sourceName: string; targetName: string };

export function DependencyPanel() {
  const { roadmap } = useRoadmapContext();
  const { initiatives } = roadmap ?? {};
  const utils = trpc.useUtils();
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdge | null>(null);

  const addDependency = trpc.initiative.addDependency.useMutation({
    onSuccess: () => {
      utils.initiative.getRoadmapData.invalidate();
      toast.success("Dependency saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeDependency = trpc.initiative.removeDependency.useMutation({
    onSuccess: () => {
      utils.initiative.getRoadmapData.invalidate();
      setSelectedEdge(null);
      toast.success("Dependency removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      addDependency.mutate({
        blockingId: connection.source,
        dependentId: connection.target,
      });
    },
    [addDependency]
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      const nameMap = new Map((initiatives ?? []).map((i) => [i.id, i.name]));
      setSelectedEdge({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceName: nameMap.get(edge.source) ?? edge.source,
        targetName: nameMap.get(edge.target) ?? edge.target,
      });
    },
    [initiatives]
  );

  const { nodes, edges } = useMemo(() => {
    const nodes = (initiatives ?? []).map((initiative, i) => ({
      id: initiative.id,
      type: "initiativeNode",
      position: { x: (i % 4) * 240, y: Math.floor(i / 4) * 130 },
      data: { initiative },
    }));

    const edges = (initiatives ?? []).flatMap((initiative) =>
      initiative.dependsOn.map((dep) => ({
        id: `${dep.blockingId}-${initiative.id}`,
        source: dep.blockingId,
        target: initiative.id,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#94a3b8", strokeWidth: 2, cursor: "pointer" },
      }))
    );

    return { nodes, edges };
  }, [initiatives]);

  return (
    <div className="mt-4 space-y-2">
      <div className="h-[400px] rounded-lg border overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          fitView
          attributionPosition="bottom-right"
        >
          <Background gap={20} size={1} color="#f1f5f9" />
          <Controls />
          <MiniMap
            nodeColor={(n) => STATUS_COLORS[(n.data as any)?.initiative?.status] ?? "#94a3b8"}
            pannable
            zoomable
          />
        </ReactFlow>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Drag from a node's right handle to another's left handle to add a dependency. Click an edge to delete it.
      </p>

      {/* Edge action bar */}
      {selectedEdge && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
          <p className="text-xs text-rose-700 min-w-0 truncate">
            <span className="font-semibold">{selectedEdge.sourceName}</span>
            {" → "}
            <span className="font-semibold">{selectedEdge.targetName}</span>
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() =>
                removeDependency.mutate({
                  blockingId: selectedEdge.source,
                  dependentId: selectedEdge.target,
                })
              }
              disabled={removeDependency.isPending}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
            <button
              onClick={() => setSelectedEdge(null)}
              className="p-1 rounded hover:bg-rose-100 text-rose-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
