"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";

export type AnnotationNodeKind =
  | "CONTAINER"
  | "NOTE"
  | "RECTANGLE"
  | "CIRCLE"
  | "CYLINDER"
  | "CLOUD";

export type AnnotationNodeData = {
  kind: AnnotationNodeKind;
  text?: string | null;
  strokeColor?: string | null;
  fillColor?: string | null;
  strokeWidth?: number | null;
  strokeStyle?: "solid" | "dashed" | "dotted" | null;
  width?: number;
  height?: number;
  onTextCommit?: (text: string) => void;
};

const DEFAULTS: Record<
  AnnotationNodeKind,
  { stroke: string; fill: string; strokeStyle: "solid" | "dashed" | "dotted"; strokeWidth: number }
> = {
  CONTAINER: { stroke: "#64748b", fill: "rgba(100,116,139,0.08)", strokeStyle: "dashed", strokeWidth: 2 },
  NOTE: { stroke: "#d97706", fill: "#fef3c7", strokeStyle: "solid", strokeWidth: 1 },
  RECTANGLE: { stroke: "#334155", fill: "#ffffff", strokeStyle: "solid", strokeWidth: 2 },
  CIRCLE: { stroke: "#334155", fill: "#ffffff", strokeStyle: "solid", strokeWidth: 2 },
  CYLINDER: { stroke: "#334155", fill: "#ffffff", strokeStyle: "solid", strokeWidth: 2 },
  CLOUD: { stroke: "#334155", fill: "#ffffff", strokeStyle: "solid", strokeWidth: 2 },
};

function dashArray(style: "solid" | "dashed" | "dotted", w: number): string | undefined {
  if (style === "dashed") return `${w * 4} ${w * 2}`;
  if (style === "dotted") return `${w} ${w * 2}`;
  return undefined;
}

function AnnotationNodeImpl({ data, selected, width, height }: NodeProps) {
  const d = data as AnnotationNodeData;
  const def = DEFAULTS[d.kind];
  const stroke = d.strokeColor ?? def.stroke;
  const fill = d.fillColor ?? def.fill;
  const strokeStyle = d.strokeStyle ?? def.strokeStyle;
  const strokeWidth = d.strokeWidth ?? def.strokeWidth;

  const w = typeof width === "number" ? width : (d.width ?? 200);
  const h = typeof height === "number" ? height : (d.height ?? 120);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.text ?? "");
  useEffect(() => setDraft(d.text ?? ""), [d.text]);

  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [editing]);

  const handleCommit = useCallback(() => {
    setEditing(false);
    if (draft !== (d.text ?? "")) d.onTextCommit?.(draft);
  }, [draft, d]);

  const dash = dashArray(strokeStyle, strokeWidth);

  // Shape SVG (for non-rectangular)
  const isSvgShape = d.kind === "CIRCLE" || d.kind === "CYLINDER" || d.kind === "CLOUD";

  return (
    <div
      className={cn(
        "relative",
        selected && "outline-2 outline-offset-2 outline-primary outline-dashed"
      )}
      style={{ width: w, height: h }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={40}
        minHeight={30}
        lineClassName="!border-primary/50"
        handleClassName="!bg-primary !border-primary !w-2 !h-2 !rounded-none"
      />

      {/* Anchor handles (used as endpoints for LINE/ARROW annotations) */}
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-full !h-1 !top-0" id="t" />
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !h-full !w-1 !left-0" id="l" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !h-full !w-1 !right-0" id="r" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-full !h-1 !bottom-0" id="b" />

      {/* Background shape */}
      {isSvgShape ? (
        <svg
          className="absolute inset-0 pointer-events-none"
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
        >
          {d.kind === "CIRCLE" && (
            <ellipse
              cx={w / 2}
              cy={h / 2}
              rx={Math.max(1, w / 2 - strokeWidth)}
              ry={Math.max(1, h / 2 - strokeWidth)}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={dash}
            />
          )}
          {d.kind === "CYLINDER" && <CylinderPath w={w} h={h} stroke={stroke} fill={fill} strokeWidth={strokeWidth} dash={dash} />}
          {d.kind === "CLOUD" && <CloudPath w={w} h={h} stroke={stroke} fill={fill} strokeWidth={strokeWidth} dash={dash} />}
        </svg>
      ) : (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: fill,
            border: `${strokeWidth}px ${strokeStyle} ${stroke}`,
            boxShadow: d.kind === "NOTE" ? "0 2px 4px rgba(0,0,0,0.08)" : undefined,
          }}
        />
      )}

      {/* Text content */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center px-3 py-2 text-center",
          d.kind === "CONTAINER" && "items-start justify-start text-left",
          d.kind === "NOTE" && "items-start text-left"
        )}
      >
        {editing ? (
          <textarea
            ref={ref}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setEditing(false);
                setDraft(d.text ?? "");
              } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleCommit();
              }
            }}
            className="w-full h-full bg-transparent resize-none outline-none text-[13px]"
            style={{ color: stroke }}
          />
        ) : (
          <span
            className={cn(
              "whitespace-pre-wrap text-[13px] leading-snug",
              d.kind === "CONTAINER" && "font-semibold text-[12px] uppercase tracking-wider"
            )}
            style={{ color: d.kind === "NOTE" ? "#78350f" : stroke }}
          >
            {d.text || (
              <span className="text-muted-foreground/40 italic">
                {d.kind === "NOTE" ? "Note" : d.kind === "CONTAINER" ? "Container" : ""}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

function CylinderPath({
  w,
  h,
  stroke,
  fill,
  strokeWidth,
  dash,
}: {
  w: number;
  h: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
  dash?: string;
}) {
  const ry = Math.min(h * 0.15, 20);
  const sw = strokeWidth;
  const d = `
    M ${sw} ${ry}
    A ${w / 2 - sw} ${ry} 0 0 1 ${w - sw} ${ry}
    L ${w - sw} ${h - ry}
    A ${w / 2 - sw} ${ry} 0 0 1 ${sw} ${h - ry}
    Z
  `;
  const topArc = `M ${sw} ${ry} A ${w / 2 - sw} ${ry} 0 0 0 ${w - sw} ${ry}`;
  return (
    <g>
      <path d={d} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
      <path d={topArc} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
    </g>
  );
}

function CloudPath({
  w,
  h,
  stroke,
  fill,
  strokeWidth,
  dash,
}: {
  w: number;
  h: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
  dash?: string;
}) {
  // Rough cloud outline with 5 bumps. Uses viewport-relative coords.
  const sw = strokeWidth;
  const path = `
    M ${w * 0.2} ${h * 0.65}
    C ${w * 0.05} ${h * 0.65}, ${w * 0.05} ${h * 0.35}, ${w * 0.22} ${h * 0.38}
    C ${w * 0.22} ${h * 0.15}, ${w * 0.5} ${h * 0.1}, ${w * 0.55} ${h * 0.3}
    C ${w * 0.65} ${h * 0.12}, ${w * 0.9} ${h * 0.2}, ${w * 0.85} ${h * 0.42}
    C ${w * 1.0} ${h * 0.45}, ${w * 0.98} ${h * 0.75}, ${w * 0.78} ${h * 0.7}
    C ${w * 0.78} ${h * 0.92}, ${w * 0.45} ${h * 0.95}, ${w * 0.4} ${h * 0.78}
    C ${w * 0.2} ${h * 0.9}, ${w * 0.05} ${h * 0.82}, ${w * 0.2} ${h * 0.65}
    Z
  `;
  return (
    <path
      d={path}
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
      strokeDasharray={dash}
      strokeLinejoin="round"
    />
  );
}

export const AnnotationNode = memo(AnnotationNodeImpl);
