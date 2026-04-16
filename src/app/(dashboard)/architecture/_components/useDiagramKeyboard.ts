"use client";

import { useEffect } from "react";
import type { DiagramTool } from "./DiagramToolRail";

type Options = {
  selectedAnnotationId: string | null;
  onToolChange: (tool: DiagramTool) => void;
  onDeleteAnnotation: () => void;
  onDuplicateAnnotation: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeselect: () => void;
  onToggleSnap: () => void;
};

const TOOL_KEYS: Record<string, DiagramTool> = {
  v: "select",
  c: "container",
  n: "note",
  r: "shape:rectangle",
  o: "shape:circle",
  d: "shape:cylinder",
  k: "shape:cloud",
  l: "line",
  a: "arrow",
};

function isTypingInField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useDiagramKeyboard({
  selectedAnnotationId,
  onToolChange,
  onDeleteAnnotation,
  onDuplicateAnnotation,
  onUndo,
  onRedo,
  onDeselect,
  onToggleSnap,
}: Options) {
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (isTypingInField(e.target)) return;

      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Undo / Redo
      if (mod && !e.shiftKey && key === "z") {
        e.preventDefault();
        onUndo();
        return;
      }
      if ((mod && e.shiftKey && key === "z") || (mod && key === "y")) {
        e.preventDefault();
        onRedo();
        return;
      }

      // Duplicate
      if (mod && key === "d") {
        e.preventDefault();
        onDuplicateAnnotation();
        return;
      }

      // Toggle snap
      if (mod && key === "'") {
        e.preventDefault();
        onToggleSnap();
        return;
      }

      if (mod) return; // let other modifiers through

      // Delete
      if ((e.key === "Delete" || e.key === "Backspace") && selectedAnnotationId) {
        e.preventDefault();
        onDeleteAnnotation();
        return;
      }

      // Escape
      if (e.key === "Escape") {
        onDeselect();
        onToolChange("select");
        return;
      }

      // Tool shortcuts (single key)
      const tool = TOOL_KEYS[key];
      if (tool) {
        e.preventDefault();
        onToolChange(tool);
      }
    }

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [
    selectedAnnotationId,
    onToolChange,
    onDeleteAnnotation,
    onDuplicateAnnotation,
    onUndo,
    onRedo,
    onDeselect,
    onToggleSnap,
  ]);
}
