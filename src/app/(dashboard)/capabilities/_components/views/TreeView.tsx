"use client";

import { useCallback, useMemo } from "react";
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
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { MATURITY_COLORS, IMPORTANCE_COLORS, MATURITY_LABELS, getGapColor, getOwnerColor } from "@/lib/constants/maturity-colors";
import type { ColorByMode } from "../CapabilityPageClient";

type Props = {
  tree: any[];
  colorBy: ColorByMode;
  onSelect: (id: string) => void;
  selectedId: string | null;
};

// Layout constants
const L1_WIDTH = 260;
const L1_HEIGHT = 80;
const L2_WIDTH = 200;
const L2_HEIGHT = 64;
const L3_WIDTH = 160;
const L3_HEIGHT = 48;
const H_GAP = 40;
const V_GAP = 100;

export function TreeView({ tree, colorBy, onSelect, selectedId }: Props) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildNodesAndEdges(tree, colorBy, selectedId),
    [tree, colorBy, selectedId]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback(
    (_: any, node: Node) => {
      onSelect(node.id);
    },
    [onSelect]
  );

  return (
    <div className="h-full w-full rounded-xl border bg-white overflow-hidden">
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e9ecef" gap={20} size={1} />
        <Controls
          showInteractive={false}
          className="!bg-white !border-[#e9ecef] !shadow-sm"
        />
        <MiniMap
          nodeColor={(node) => {
            if (node.data?.level === "L1") return "#1a1f2e";
            if (node.data?.level === "L2") return "#86BC25";
            return "#94a3b8";
          }}
          maskColor="rgba(0,0,0,0.05)"
          className="!bg-[#fafbfc] !border-[#e9ecef]"
        />
      </ReactFlow>
    </div>
  );
}

// ─── Custom Nodes ────────────────────────────────────────

function L1Node({ data, selected }: { data: any; selected: boolean }) {
  const color = data.maturityColor;
  return (
    <div
      className={`rounded-xl border-2 bg-[#1a1f2e] text-white px-4 py-3 shadow-lg transition-all cursor-pointer ${
        selected ? "ring-2 ring-[#86BC25] ring-offset-2" : ""
      }`}
      style={{ width: L1_WIDTH, minHeight: L1_HEIGHT }}
    >
      <Handle type="target" position={Position.Top} className="!bg-[#86BC25] !w-2 !h-2" />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded">
          L1
        </span>
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <p className="text-sm font-semibold leading-tight">{data.label}</p>
      <p className="text-[10px] text-white/50 mt-1">
        {data.childCount} sub-capabilities
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-[#86BC25] !w-2 !h-2" />
    </div>
  );
}

function L2Node({ data, selected }: { data: any; selected: boolean }) {
  const color = data.maturityColor;
  return (
    <div
      className={`rounded-lg border bg-white px-3 py-2.5 shadow-sm transition-all cursor-pointer hover:shadow-md ${
        selected ? "ring-2 ring-[#86BC25] ring-offset-1 border-[#86BC25]" : "border-[#e9ecef]"
      }`}
      style={{ width: L2_WIDTH, minHeight: L2_HEIGHT }}
    >
      <Handle type="target" position={Position.Top} className="!bg-[#86BC25] !w-1.5 !h-1.5" />
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[8px] font-bold text-[#86BC25] bg-[#86BC25]/10 px-1 py-0.5 rounded">
          L2
        </span>
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <p className="text-xs font-medium text-[#1a1f2e] leading-tight">
        {data.label}
      </p>
      {data.maturityLabel && data.maturityLabel !== "Not Assessed" && (
        <p className="text-[9px] mt-1" style={{ color }}>
          {data.maturityLabel}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-[#86BC25] !w-1.5 !h-1.5" />
    </div>
  );
}

function L3Node({ data, selected }: { data: any; selected: boolean }) {
  const color = data.maturityColor;
  return (
    <div
      className={`rounded-md border px-2.5 py-2 shadow-sm transition-all cursor-pointer hover:shadow-md ${
        selected ? "ring-2 ring-[#86BC25] ring-offset-1 border-[#86BC25]" : "border-[#e9ecef]"
      }`}
      style={{ width: L3_WIDTH, minHeight: L3_HEIGHT, backgroundColor: "#fafbfc" }}
    >
      <Handle type="target" position={Position.Top} className="!bg-[#94a3b8] !w-1.5 !h-1.5" />
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-[7px] font-bold text-muted-foreground bg-muted px-1 py-0.5 rounded">
          L3
        </span>
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <p className="text-[10px] font-medium text-[#495057] leading-tight">
        {data.label}
      </p>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  l1: L1Node,
  l2: L2Node,
  l3: L3Node,
};

// ─── Layout Builder ──────────────────────────────────────

function buildNodesAndEdges(
  tree: any[],
  colorBy: ColorByMode,
  selectedId: string | null
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let l1X = 0;

  for (const l1 of tree) {
    const l1Color = getColor(l1, colorBy);
    const l2Children = l1.children ?? [];

    // Calculate L1 x position based on the width needed for its L2 children
    const l2TotalWidth = Math.max(
      L1_WIDTH,
      l2Children.length * (L2_WIDTH + H_GAP) - H_GAP
    );

    const l1CenterX = l1X + l2TotalWidth / 2 - L1_WIDTH / 2;

    nodes.push({
      id: l1.id,
      type: "l1",
      position: { x: l1CenterX, y: 0 },
      data: {
        label: l1.name,
        level: "L1",
        maturityColor: l1Color,
        childCount: l2Children.length,
      },
      selected: selectedId === l1.id,
    });

    // L2 nodes
    let l2X = l1X;
    for (const l2 of l2Children) {
      const l2Color = getColor(l2, colorBy);
      const l3Children = l2.children ?? [];

      const l3TotalWidth = Math.max(
        L2_WIDTH,
        l3Children.length * (L3_WIDTH + H_GAP / 2) - H_GAP / 2
      );
      const l2CenterX = l2X + Math.max(l3TotalWidth, L2_WIDTH) / 2 - L2_WIDTH / 2;

      nodes.push({
        id: l2.id,
        type: "l2",
        position: { x: l2CenterX, y: V_GAP + L1_HEIGHT },
        data: {
          label: l2.name,
          level: "L2",
          maturityColor: l2Color,
          maturityLabel: MATURITY_LABELS[l2.currentMaturity] ?? null,
        },
        selected: selectedId === l2.id,
      });

      edges.push({
        id: `${l1.id}-${l2.id}`,
        source: l1.id,
        target: l2.id,
        type: "smoothstep",
        style: { stroke: "#cbd5e1", strokeWidth: 1.5 },
        animated: false,
      });

      // L3 nodes
      let l3X = l2X;
      for (const l3 of l3Children) {
        const l3Color = getColor(l3, colorBy);

        nodes.push({
          id: l3.id,
          type: "l3",
          position: {
            x: l3X,
            y: 2 * V_GAP + L1_HEIGHT + L2_HEIGHT,
          },
          data: {
            label: l3.name,
            level: "L3",
            maturityColor: l3Color,
          },
          selected: selectedId === l3.id,
        });

        edges.push({
          id: `${l2.id}-${l3.id}`,
          source: l2.id,
          target: l3.id,
          type: "smoothstep",
          style: { stroke: "#e2e8f0", strokeWidth: 1 },
          animated: false,
        });

        l3X += L3_WIDTH + H_GAP / 2;
      }

      l2X += Math.max(l3TotalWidth, L2_WIDTH) + H_GAP;
    }

    l1X = l2X + H_GAP * 2;
  }

  return { nodes, edges };
}

function getColor(node: any, colorBy: ColorByMode): string {
  if (colorBy === "maturity") return MATURITY_COLORS[node.currentMaturity] ?? MATURITY_COLORS.NOT_ASSESSED;
  if (colorBy === "importance") return IMPORTANCE_COLORS[node.strategicImportance] ?? IMPORTANCE_COLORS.NOT_ASSESSED;
  if (colorBy === "gap") return getGapColor(node);
  return getOwnerColor(node.owner?.id);
}
