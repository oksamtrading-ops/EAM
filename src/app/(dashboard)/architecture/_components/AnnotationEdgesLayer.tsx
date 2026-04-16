"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import type { DiagramAnnotation } from "./ArchitectureCanvas";

export type Anchor =
  | { kind: "APP"; refId: string; handle?: "t" | "l" | "r" | "b" }
  | { kind: "ANNOTATION"; refId: string; handle?: "t" | "l" | "r" | "b" }
  | { kind: "FREE"; x: number; y: number };

export type Waypoint = { x: number; y: number };

export type PendingLine = {
  tool: "line" | "arrow";
  sourceAnchor: Anchor;
  cursor: { x: number; y: number };
};

type Props = {
  annotations: DiagramAnnotation[];
  pendingLine: PendingLine | null;
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
  onUpdateWaypoints: (id: string, waypoints: Waypoint[]) => void;
};

// Resolve an anchor to an absolute flow point using current React Flow nodes.
function resolveAnchorPoint(
  anchor: Anchor,
  nodeLookup: Map<string, { x: number; y: number; w: number; h: number }>
): { x: number; y: number } | null {
  if (anchor.kind === "FREE") return { x: anchor.x, y: anchor.y };
  const refNode =
    anchor.kind === "APP"
      ? nodeLookup.get(anchor.refId)
      : nodeLookup.get(`ann:${anchor.refId}`);
  if (!refNode) return null;
  const { x, y, w, h } = refNode;
  switch (anchor.handle) {
    case "t":
      return { x: x + w / 2, y };
    case "b":
      return { x: x + w / 2, y: y + h };
    case "l":
      return { x, y: y + h / 2 };
    case "r":
      return { x: x + w, y: y + h / 2 };
    default:
      return { x: x + w / 2, y: y + h / 2 };
  }
}

// Pick the closest side handle on a node given a target point
export function pickHandleForPoint(
  node: { x: number; y: number; w: number; h: number },
  target: { x: number; y: number }
): "t" | "l" | "r" | "b" {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "r" : "l";
  }
  return dy >= 0 ? "b" : "t";
}

// Build orthogonal path points between two points following L-shape logic
function orthogonalPath(
  a: { x: number; y: number },
  b: { x: number; y: number },
  waypoints: Waypoint[]
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [a];
  if (waypoints.length > 0) {
    // Route: a → first waypoint with a single bend, waypoint → waypoint, last → b with bend
    pts.push(...waypoints);
  } else {
    // Single L-shape elbow: horizontal first, then vertical
    const midX = (a.x + b.x) / 2;
    pts.push({ x: midX, y: a.y });
    pts.push({ x: midX, y: b.y });
  }
  pts.push(b);
  return pts;
}

function pointsToSvgPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

export function AnnotationEdgesLayer({
  annotations,
  pendingLine,
  selectedAnnotationId,
  onSelectAnnotation,
  onUpdateWaypoints,
}: Props) {
  const { screenToFlowPosition } = useReactFlow();
  // Subscribe to transform to re-render on pan/zoom
  const [tx, ty, zoom] = useStore((s) => s.transform);
  // Subscribe to node positions/sizes for anchor resolution
  const nodeInternals = useStore((s) => s.nodeLookup);

  const nodeLookup = useMemo(() => {
    const out = new Map<string, { x: number; y: number; w: number; h: number }>();
    nodeInternals.forEach((n: any, key: string) => {
      const pos = n.internals?.positionAbsolute ?? n.position;
      const w =
        (n.measured?.width as number | undefined) ??
        (n.width as number | undefined) ??
        (n.style?.width as number | undefined) ??
        120;
      const h =
        (n.measured?.height as number | undefined) ??
        (n.height as number | undefined) ??
        (n.style?.height as number | undefined) ??
        60;
      out.set(key, { x: pos.x, y: pos.y, w, h });
    });
    return out;
  }, [nodeInternals]);

  const lineAnnotations = useMemo(
    () => annotations.filter((a) => a.type === "LINE" || a.type === "ARROW"),
    [annotations]
  );

  // Drag a waypoint
  const dragRef = useRef<{ annId: string; wpIndex: number } | null>(null);
  const [draftWaypoints, setDraftWaypoints] = useState<
    Record<string, Waypoint[] | undefined>
  >({});

  const onWaypointMouseDown = useCallback(
    (annId: string, wpIndex: number) => (e: React.MouseEvent) => {
      e.stopPropagation();
      dragRef.current = { annId, wpIndex };
      const ann = lineAnnotations.find((a) => a.id === annId);
      const wps = Array.isArray(ann?.waypoints) ? ((ann!.waypoints as unknown) as Waypoint[]) : [];
      setDraftWaypoints((d) => ({ ...d, [annId]: [...wps] }));
    },
    [lineAnnotations]
  );

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const { annId, wpIndex } = dragRef.current;
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setDraftWaypoints((d) => {
        const wps = [...(d[annId] ?? [])];
        wps[wpIndex] = { x: Math.round(p.x), y: Math.round(p.y) };
        return { ...d, [annId]: wps };
      });
    }
    function onUp() {
      if (!dragRef.current) return;
      const { annId } = dragRef.current;
      dragRef.current = null;
      setDraftWaypoints((d) => {
        const wps = d[annId];
        if (wps) onUpdateWaypoints(annId, wps);
        return { ...d, [annId]: undefined };
      });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [screenToFlowPosition, onUpdateWaypoints]);

  function addWaypoint(annId: string, atIndex: number, point: Waypoint) {
    const ann = lineAnnotations.find((a) => a.id === annId);
    const wps = Array.isArray(ann?.waypoints) ? ((ann!.waypoints as unknown) as Waypoint[]) : [];
    const next = [...wps];
    next.splice(atIndex, 0, point);
    onUpdateWaypoints(annId, next);
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    >
      <defs>
        <marker
          id="arrow-head"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="10"
          markerHeight="10"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>
      <g transform={`translate(${tx},${ty}) scale(${zoom})`}>
        {lineAnnotations.map((ann) => {
          const src = resolveAnchorPoint((ann.sourceAnchor as Anchor) ?? { kind: "FREE", x: ann.x, y: ann.y }, nodeLookup);
          const tgt = resolveAnchorPoint((ann.targetAnchor as Anchor) ?? { kind: "FREE", x: ann.x + 120, y: ann.y }, nodeLookup);
          if (!src || !tgt) return null;

          const wpsRaw = draftWaypoints[ann.id] ?? (Array.isArray(ann.waypoints) ? ((ann.waypoints as unknown) as Waypoint[]) : []);
          const pts = ann.routing === "straight"
            ? [src, ...wpsRaw, tgt]
            : orthogonalPath(src, tgt, wpsRaw);
          const d = pointsToSvgPath(pts);
          const stroke = ann.strokeColor ?? "#334155";
          const strokeWidth = ann.strokeWidth ?? 2;
          const strokeDasharray =
            ann.strokeStyle === "dashed"
              ? `${strokeWidth * 4} ${strokeWidth * 2}`
              : ann.strokeStyle === "dotted"
                ? `${strokeWidth} ${strokeWidth * 2}`
                : undefined;
          const isSelected = selectedAnnotationId === ann.id;
          const isArrow = ann.type === "ARROW";

          return (
            <g key={ann.id} color={stroke} className="pointer-events-auto">
              {/* Invisible wide hit path */}
              <path
                d={d}
                stroke="transparent"
                strokeWidth={Math.max(10, strokeWidth + 8)}
                fill="none"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAnnotation(ann.id);
                }}
                style={{ cursor: "pointer" }}
              />
              {/* Visible line */}
              <path
                d={d}
                stroke={stroke}
                strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
                strokeDasharray={strokeDasharray}
                fill="none"
                markerEnd={isArrow && (ann.headTarget ?? true) ? "url(#arrow-head)" : undefined}
                markerStart={isArrow && ann.headSource ? "url(#arrow-head)" : undefined}
                pointerEvents="none"
              />

              {/* Waypoint handles (when selected) */}
              {isSelected && (
                <>
                  {wpsRaw.map((wp, i) => (
                    <rect
                      key={`wp-${i}`}
                      x={wp.x - 5}
                      y={wp.y - 5}
                      width={10}
                      height={10}
                      fill="#ffffff"
                      stroke="#2563eb"
                      strokeWidth={2}
                      style={{ cursor: "move" }}
                      onMouseDown={onWaypointMouseDown(ann.id, i)}
                    />
                  ))}
                  {/* Mid-segment add-waypoint plus handles */}
                  {pts.slice(0, -1).map((p, i) => {
                    const next = pts[i + 1]!;
                    const mid = { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 };
                    // Position is mapped into a waypoint array index.
                    // If no existing waypoints, adding to any segment inserts at index 0..segCount.
                    return (
                      <circle
                        key={`add-${i}`}
                        cx={mid.x}
                        cy={mid.y}
                        r={4}
                        fill="#ffffff"
                        stroke="#9ca3af"
                        strokeWidth={1.5}
                        style={{ cursor: "copy" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Insert at index i when src→first wp gap is i=0, etc.
                          // Because pts = [src, ...wps, tgt], segment i connects
                          // wps[i-1] → wps[i] (src=i-1=-1, tgt=i=wps.length).
                          addWaypoint(ann.id, Math.max(0, i), mid);
                        }}
                      />
                    );
                  })}
                </>
              )}
            </g>
          );
        })}

        {/* Pending line preview (during creation) */}
        {pendingLine && (() => {
          const src = resolveAnchorPoint(pendingLine.sourceAnchor, nodeLookup);
          if (!src) return null;
          const tgt = pendingLine.cursor;
          const pts = orthogonalPath(src, tgt, []);
          return (
            <g>
              <path
                d={pointsToSvgPath(pts)}
                stroke="#2563eb"
                strokeWidth={2}
                strokeDasharray="4 4"
                fill="none"
                opacity={0.7}
                markerEnd={pendingLine.tool === "arrow" ? "url(#arrow-head)" : undefined}
              />
              <circle cx={src.x} cy={src.y} r={4} fill="#2563eb" />
            </g>
          );
        })()}
      </g>
    </svg>
  );
}
