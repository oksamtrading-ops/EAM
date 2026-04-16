"use client";

import { useEffect, useState } from "react";
import { X, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export type AnnotationPatch = {
  text?: string | null;
  strokeColor?: string | null;
  fillColor?: string | null;
  strokeWidth?: number | null;
  strokeStyle?: "solid" | "dashed" | "dotted" | null;
  z?: number;
};

export type SelectedAnnotation = {
  id: string;
  type: string;
  text: string | null;
  strokeColor: string | null;
  fillColor: string | null;
  strokeWidth: number | null;
  strokeStyle: string | null;
  z: number;
};

const STROKE_STYLES: Array<"solid" | "dashed" | "dotted"> = ["solid", "dashed", "dotted"];

const COLOR_PRESETS = [
  "#0f172a", // slate-900
  "#334155", // slate-700
  "#64748b", // slate-500
  "#dc2626", // red-600
  "#ea580c", // orange-600
  "#ca8a04", // yellow-600
  "#16a34a", // green-600
  "#0891b2", // cyan-600
  "#2563eb", // blue-600
  "#7c3aed", // violet-600
  "#db2777", // pink-600
  "#ffffff",
];

const FILL_PRESETS = [
  "transparent",
  "#ffffff",
  "#fef3c7", // amber-100
  "#dcfce7", // green-100
  "#dbeafe", // blue-100
  "#ede9fe", // violet-100
  "#fee2e2", // red-100
  "#f1f5f9", // slate-100
];

export function AnnotationPropertiesPanel({
  annotation,
  onClose,
  onPatch,
  onDelete,
  onBringForward,
  onSendBackward,
}: {
  annotation: SelectedAnnotation;
  onClose: () => void;
  onPatch: (patch: AnnotationPatch) => void;
  onDelete: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
}) {
  const [text, setText] = useState(annotation.text ?? "");
  useEffect(() => setText(annotation.text ?? ""), [annotation.id, annotation.text]);

  const strokeWidth = annotation.strokeWidth ?? 2;

  return (
    <div className="w-[300px] shrink-0 border-l bg-card flex flex-col">
      <div className="shrink-0 border-b px-4 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Annotation
          </p>
          <p className="text-sm font-semibold truncate">{annotation.type}</p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-md text-muted-foreground hover:bg-muted/60 flex items-center justify-center"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Text */}
        <div className="space-y-1.5">
          <Label className="text-xs">Text</Label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              if ((text ?? "") !== (annotation.text ?? "")) {
                onPatch({ text: text || null });
              }
            }}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>

        {/* Stroke color */}
        <Section label="Stroke color">
          <ColorSwatchRow
            value={annotation.strokeColor}
            presets={COLOR_PRESETS}
            onChange={(v) => onPatch({ strokeColor: v })}
          />
        </Section>

        {/* Fill color */}
        <Section label="Fill color">
          <ColorSwatchRow
            value={annotation.fillColor}
            presets={FILL_PRESETS}
            onChange={(v) => onPatch({ fillColor: v === "transparent" ? null : v })}
          />
        </Section>

        {/* Stroke width */}
        <Section label="Stroke width">
          <div className="flex items-center gap-2">
            <Slider
              min={0}
              max={8}
              step={1}
              value={strokeWidth}
              onValueChange={() => {}}
              onValueCommitted={(v) => {
                const n = Array.isArray(v) ? v[0]! : (v as number);
                onPatch({ strokeWidth: n });
              }}
              className="flex-1"
            />
            <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
              {strokeWidth}px
            </span>
          </div>
        </Section>

        {/* Stroke style */}
        <Section label="Stroke style">
          <div className="flex gap-1">
            {STROKE_STYLES.map((s) => (
              <button
                key={s}
                onClick={() => onPatch({ strokeStyle: s })}
                className={cn(
                  "flex-1 h-8 rounded-md border text-[11px] capitalize transition-colors",
                  (annotation.strokeStyle ?? "solid") === s
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </Section>

        {/* Z-order */}
        <Section label="Layer">
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={onBringForward} className="flex-1">
              <ArrowUp className="h-3.5 w-3.5 mr-1" /> Forward
            </Button>
            <Button variant="outline" size="sm" onClick={onSendBackward} className="flex-1">
              <ArrowDown className="h-3.5 w-3.5 mr-1" /> Back
            </Button>
          </div>
        </Section>
      </div>

      <div className="shrink-0 border-t p-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onDelete}
          className="w-full text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete annotation
        </Button>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ColorSwatchRow({
  value,
  presets,
  onChange,
}: {
  value: string | null;
  presets: string[];
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {presets.map((c) => {
        const selected = (value ?? "") === c || (value == null && c === "transparent");
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            title={c}
            className={cn(
              "relative w-6 h-6 rounded-md border transition-all",
              selected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "hover:scale-110",
              c === "transparent" && "bg-[linear-gradient(45deg,transparent_46%,#e5e7eb_46%,#e5e7eb_54%,transparent_54%)]"
            )}
            style={c === "transparent" ? {} : { background: c, borderColor: c === "#ffffff" ? "#e5e7eb" : c }}
          />
        );
      })}
      <Input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder="#rrggbb"
        className="h-6 w-24 text-[11px] px-2"
      />
    </div>
  );
}
