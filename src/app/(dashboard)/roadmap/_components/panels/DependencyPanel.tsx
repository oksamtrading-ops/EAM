"use client";

import { useMemo } from "react";
import { ReactFlow, Background, Controls, MiniMap, Handle, Position, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
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

export function DependencyPanel() {
  const { roadmap } = useRoadmapContext();
  const { initiatives } = roadmap ?? {};

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
        style: { stroke: "#94a3b8" },
      }))
    );

    return { nodes, edges };
  }, [initiatives]);

  return (
    <div className="h-[440px] rounded-lg border overflow-hidden mt-4">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
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
  );
}
