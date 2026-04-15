"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyRound, Link2, Network, Plus, Minus, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useDataContext } from "../DataContext";
import { cn } from "@/lib/utils";
import {
  CLASSIFICATION_COLORS,
  CLASSIFICATION_LABELS,
  ENTITY_TYPE_LABELS,
} from "@/lib/constants/data-architecture-colors";

const CARD_W = 260;
const CARD_HEADER_H = 36;
const CARD_ATTR_H = 26;
const CARD_EMPTY_H = 36;
const HORIZONTAL_GAP = 60;
const VERTICAL_GAP = 48;
const MAX_ZOOM = 2;
const MIN_ZOOM = 0.3;
const CLICK_THRESHOLD_PX = 4;

type DragState =
  | null
  | {
      kind: "pan";
      originX: number;
      originY: number;
      startPanX: number;
      startPanY: number;
      moved: boolean;
    }
  | {
      kind: "card";
      entityId: string;
      originX: number;
      originY: number;
      startX: number;
      startY: number;
      moved: boolean;
    };

export function ErdView() {
  const { setSelectedEntityId } = useDataContext();
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1);
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const dragRef = useRef<DragState>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: domains = [], isLoading: domainsLoading } =
    trpc.dataDomain.list.useQuery();
  const { data: entities = [] } = trpc.dataEntity.list.useQuery();

  // Default-select first domain that has entities.
  useEffect(() => {
    if (selectedDomainId || domains.length === 0) return;
    const firstWithEntities = domains.find((d) =>
      entities.some((e) => e.domain.id === d.id)
    );
    setSelectedDomainId(firstWithEntities?.id ?? domains[0]?.id ?? null);
  }, [selectedDomainId, domains, entities]);

  const domainEntities = useMemo(
    () =>
      entities
        .filter((e) => e.domain.id === selectedDomainId)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [entities, selectedDomainId]
  );

  const { data: attributes = [] } = trpc.dataAttribute.listByDomain.useQuery(
    { domainId: selectedDomainId ?? "" },
    { enabled: !!selectedDomainId }
  );

  const attrsByEntity = useMemo(() => {
    const m = new Map<string, typeof attributes>();
    for (const a of attributes) {
      const arr = m.get(a.entityId) ?? [];
      arr.push(a);
      m.set(a.entityId, arr);
    }
    return m;
  }, [attributes]);

  const cardHeight = useCallback(
    (entityId: string) => {
      const count = attrsByEntity.get(entityId)?.length ?? 0;
      if (count === 0) return CARD_HEADER_H + CARD_EMPTY_H;
      return CARD_HEADER_H + count * CARD_ATTR_H;
    },
    [attrsByEntity]
  );

  // Compute deterministic default grid positions for any entity without one.
  // Column width is fixed; column height is the tallest card in that column,
  // so variable-sized cards don't overlap.
  useEffect(() => {
    if (domainEntities.length === 0) return;
    setPositions((prev) => {
      const next = { ...prev };
      let changed = false;
      const cols = Math.max(1, Math.ceil(Math.sqrt(domainEntities.length)));
      const columnOffsets: number[] = Array.from({ length: cols }, () => 0);
      domainEntities.forEach((e, i) => {
        const col = i % cols;
        const x = col * (CARD_W + HORIZONTAL_GAP);
        const y = columnOffsets[col];
        columnOffsets[col] = y + cardHeight(e.id) + VERTICAL_GAP;
        if (!next[e.id]) {
          next[e.id] = { x, y };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [domainEntities, cardHeight]);

  // Clear layout + viewport when switching domains.
  const resetLayout = useCallback(() => {
    setPositions({});
    setPan({ x: 40, y: 40 });
    setZoom(1);
  }, []);

  useEffect(() => {
    setPositions({});
    setPan({ x: 40, y: 40 });
    setZoom(1);
  }, [selectedDomainId]);

  // In-domain FK edges only (cross-domain refs shown text-only on the card).
  const edges = useMemo(() => {
    const domainEntityIds = new Set(domainEntities.map((e) => e.id));
    const out: { srcId: string; srcAttrIdx: number; tgtId: string; key: string }[] =
      [];
    for (const e of domainEntities) {
      const attrs = attrsByEntity.get(e.id) ?? [];
      attrs.forEach((a, idx) => {
        if (
          a.isForeignKey &&
          a.fkTargetEntityId &&
          domainEntityIds.has(a.fkTargetEntityId)
        ) {
          out.push({
            srcId: e.id,
            srcAttrIdx: idx,
            tgtId: a.fkTargetEntityId,
            key: a.id,
          });
        }
      });
    }
    return out;
  }, [domainEntities, attrsByEntity]);

  // ── Pointer handlers ─────────────────────────────────────────────
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragRef.current = {
      kind: "pan",
      originX: e.clientX,
      originY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onCardPointerDown = (e: React.PointerEvent, entityId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const pos = positions[entityId];
    if (!pos) return;
    dragRef.current = {
      kind: "card",
      entityId,
      originX: e.clientX,
      originY: e.clientY,
      startX: pos.x,
      startY: pos.y,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.originX;
    const dy = e.clientY - d.originY;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > CLICK_THRESHOLD_PX) {
      d.moved = true;
    }
    if (d.kind === "pan") {
      setPan({ x: d.startPanX + dx, y: d.startPanY + dy });
    } else {
      setPositions((prev) => ({
        ...prev,
        [d.entityId]: {
          x: d.startX + dx / zoom,
          y: d.startY + dy / zoom,
        },
      }));
    }
  };

  const onPointerUp = (e: React.PointerEvent, entityId?: string) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && d.kind === "card" && !d.moved && entityId) {
      setSelectedEntityId(entityId);
    }
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  // Ctrl/⌘ + wheel → zoom toward cursor. Plain wheel scrolls (no hijack).
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!containerRef.current) return;
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      setZoom((prevZoom) => {
        const newZoom = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, prevZoom * (1 + delta))
        );
        if (newZoom === prevZoom) return prevZoom;
        const rect = containerRef.current!.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        setPan((prevPan) => {
          const worldX = (cx - prevPan.x) / prevZoom;
          const worldY = (cy - prevPan.y) / prevZoom;
          return {
            x: cx - worldX * newZoom,
            y: cy - worldY * newZoom,
          };
        });
        return newZoom;
      });
    },
    []
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  if (domainsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (domains.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Network className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-base font-semibold mb-1">No domains yet</h3>
          <p className="text-sm text-muted-foreground">
            Create a domain and add entities to see the ERD.
          </p>
        </div>
      </div>
    );
  }

  const selectedDomain = domains.find((d) => d.id === selectedDomainId) ?? null;

  return (
    <div className="h-full flex flex-col">
      {/* Domain selector */}
      <div className="shrink-0 border-b border-border bg-background px-4 py-2 flex items-center gap-2 overflow-x-auto">
        {domains.map((d) => {
          const count = entities.filter((e) => e.domain.id === d.id).length;
          return (
            <button
              key={d.id}
              onClick={() => setSelectedDomainId(d.id)}
              className={cn(
                "shrink-0 inline-flex items-center gap-2 px-3 h-7 rounded-md text-[12px] font-medium transition-colors",
                selectedDomainId === d.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: d.color ?? "#0B5CD6" }}
              />
              {d.name}
              <span className="text-[10px] opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => onPointerUp(e)}
        onPointerCancel={(e) => onPointerUp(e)}
        className="flex-1 relative overflow-hidden bg-muted/30 select-none touch-none cursor-grab active:cursor-grabbing"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(148,163,184,0.35) 1px, transparent 1px)",
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {domainEntities.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            {selectedDomain
              ? `No entities in "${selectedDomain.name}"`
              : "Select a domain to see its ERD"}
          </div>
        ) : (
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            {/* Edges layer */}
            <svg
              className="absolute top-0 left-0 pointer-events-none"
              style={{ overflow: "visible", width: 1, height: 1 }}
              aria-hidden
            >
              <defs>
                <marker
                  id="erd-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                </marker>
              </defs>
              {edges.map(({ srcId, srcAttrIdx, tgtId, key }) => {
                const src = positions[srcId];
                const tgt = positions[tgtId];
                if (!src || !tgt) return null;
                const x1 = src.x + CARD_W;
                const y1 =
                  src.y + CARD_HEADER_H + (srcAttrIdx + 0.5) * CARD_ATTR_H;
                const x2 = tgt.x;
                const y2 = tgt.y + CARD_HEADER_H / 2;
                const midX = (x1 + x2) / 2;
                const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
                return (
                  <path
                    key={key}
                    d={d}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    markerEnd="url(#erd-arrow)"
                  />
                );
              })}
            </svg>

            {/* Entity cards */}
            {domainEntities.map((e) => {
              const pos = positions[e.id];
              if (!pos) return null;
              const attrs = attrsByEntity.get(e.id) ?? [];
              const domainColor = e.domain.color ?? "#0B5CD6";
              return (
                <div
                  key={e.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${e.name}`}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      setSelectedEntityId(e.id);
                    }
                  }}
                  className="absolute bg-card border border-border rounded-md shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: CARD_W,
                  }}
                  onPointerDown={(ev) => onCardPointerDown(ev, e.id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={(ev) => onPointerUp(ev, e.id)}
                  onPointerCancel={(ev) => onPointerUp(ev, e.id)}
                >
                  <div
                    className="px-3 text-[12px] font-semibold text-white flex items-center justify-between cursor-grab active:cursor-grabbing"
                    style={{ height: CARD_HEADER_H, backgroundColor: domainColor }}
                  >
                    <span className="truncate">{e.name}</span>
                    <span className="text-[9px] uppercase opacity-80 shrink-0 ml-2">
                      {ENTITY_TYPE_LABELS[e.entityType] ?? e.entityType}
                    </span>
                  </div>
                  {attrs.length === 0 ? (
                    <div
                      className="px-3 flex items-center justify-center text-[11px] italic text-muted-foreground"
                      style={{ height: CARD_EMPTY_H }}
                    >
                      No attributes defined
                    </div>
                  ) : (
                    <div>
                      {attrs.map((a) => {
                        const isSensitiveUnclassified =
                          a.regulatoryTags.length > 0 &&
                          a.classification === "DC_UNKNOWN";
                        return (
                          <div
                            key={a.id}
                            className="px-3 flex items-center justify-between gap-2 text-[11px] border-t border-border/50"
                            style={{ height: CARD_ATTR_H }}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              {a.isPrimaryKey ? (
                                <KeyRound className="h-3 w-3 shrink-0 text-amber-500" />
                              ) : a.isForeignKey ? (
                                <Link2 className="h-3 w-3 shrink-0 text-blue-500" />
                              ) : (
                                <span className="w-3 shrink-0" />
                              )}
                              <span
                                className={cn(
                                  "truncate",
                                  a.isPrimaryKey && "font-semibold",
                                  isSensitiveUnclassified
                                    ? "text-red-600"
                                    : "text-foreground"
                                )}
                              >
                                {a.name}
                              </span>
                              <span className="text-muted-foreground truncate text-[10px]">
                                {a.dataType}
                              </span>
                            </div>
                            <span
                              title={
                                CLASSIFICATION_LABELS[a.classification] ??
                                a.classification
                              }
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{
                                backgroundColor:
                                  CLASSIFICATION_COLORS[a.classification] ??
                                  "#94a3b8",
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 flex flex-col bg-background border border-border rounded-md shadow-sm">
          <button
            className="h-7 w-7 flex items-center justify-center hover:bg-muted"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.2))}
            aria-label="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            className="h-7 w-7 flex items-center justify-center hover:bg-muted border-t border-border"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.2))}
            aria-label="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            className="h-7 w-7 flex items-center justify-center hover:bg-muted border-t border-border"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={resetLayout}
            aria-label="Reset layout"
            title="Reset layout"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="absolute bottom-3 left-3 text-[10px] text-muted-foreground bg-background/80 rounded px-2 py-1 pointer-events-none">
          Drag to pan · Ctrl/⌘ + wheel to zoom · Drag cards · Click to open
        </div>
      </div>
    </div>
  );
}
