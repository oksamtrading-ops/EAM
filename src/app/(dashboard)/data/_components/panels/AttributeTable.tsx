"use client";

import { useState } from "react";
import { KeyRound, Trash2, Plus, MoreHorizontal } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  CLASSIFICATION_COLORS,
  CLASSIFICATION_LABELS,
  CLASSIFICATION_OPTIONS,
  REGULATORY_TAG_COLORS,
  REGULATORY_TAG_LABELS,
  REGULATORY_TAG_OPTIONS,
} from "@/lib/constants/data-architecture-colors";

type RegTag = (typeof REGULATORY_TAG_OPTIONS)[number];
type Classification = (typeof CLASSIFICATION_OPTIONS)[number];

type AttributePatch = Parameters<
  ReturnType<typeof trpc.dataAttribute.update.useMutation>["mutate"]
>[0];

interface EntityLite {
  id: string;
  name: string;
  domain?: { name: string } | null;
}

interface Props {
  entityId: string;
  allEntities: EntityLite[];
}

export function AttributeTable({ entityId, allEntities }: Props) {
  const utils = trpc.useUtils();
  const { data: attributes = [] } = trpc.dataAttribute.list.useQuery({ entityId });
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");

  const invalidate = () => {
    utils.dataAttribute.list.invalidate({ entityId });
    utils.dataEntity.autoScanFindings.invalidate();
  };

  const createMutation = trpc.dataAttribute.create.useMutation({
    onSuccess: () => {
      invalidate();
      setNewName("");
      setNewType("");
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.dataAttribute.update.useMutation({
    onSuccess: invalidate,
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.dataAttribute.delete.useMutation({
    onSuccess: invalidate,
    onError: (err) => toast.error(err.message),
  });

  function patch(p: AttributePatch) {
    updateMutation.mutate(p);
  }

  function addAttribute() {
    const name = newName.trim();
    const dataType = newType.trim();
    if (!name || !dataType) return;
    createMutation.mutate({ entityId, name, dataType });
  }

  return (
    <div className="space-y-2">
      {attributes.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No attributes defined yet. Add fields below.
        </p>
      ) : (
        <div className="space-y-1">
          {attributes.map((a) => (
            <AttributeRow
              key={a.id}
              attr={a}
              allEntities={allEntities}
              onPatch={patch}
              onDelete={() => deleteMutation.mutate({ id: a.id })}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 pt-1">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="field name"
          className="h-7 text-xs flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") addAttribute();
          }}
        />
        <Input
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          placeholder="type"
          className="h-7 text-xs w-24 font-mono"
          onKeyDown={(e) => {
            if (e.key === "Enter") addAttribute();
          }}
        />
        <Button
          type="button"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={addAttribute}
          disabled={createMutation.isPending || !newName.trim() || !newType.trim()}
        >
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
    </div>
  );
}

type Attribute = {
  id: string;
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  fkTargetEntityId: string | null;
  classification: string;
  regulatoryTags: string[];
  description: string | null;
};

function AttributeRow({
  attr,
  allEntities,
  onPatch,
  onDelete,
}: {
  attr: Attribute;
  allEntities: EntityLite[];
  onPatch: (p: AttributePatch) => void;
  onDelete: () => void;
}) {
  const classColor = CLASSIFICATION_COLORS[attr.classification] ?? "#64748b";
  const regTags = attr.regulatoryTags as RegTag[];
  const classLabel = attr.classification === "DC_UNKNOWN" ? "?" : attr.classification.slice(0, 3);
  const advancedActive = regTags.length > 0 || attr.isForeignKey || !!attr.description;

  function toggleTag(tag: RegTag) {
    const next = regTags.includes(tag) ? regTags.filter((t) => t !== tag) : [...regTags, tag];
    onPatch({ id: attr.id, regulatoryTags: next });
  }

  return (
    <div className="group flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card hover:bg-muted/30">
      {/* PK indicator + toggle */}
      <button
        type="button"
        onClick={() => onPatch({ id: attr.id, isPrimaryKey: !attr.isPrimaryKey })}
        title={attr.isPrimaryKey ? "Primary key" : "Mark as primary key"}
        className={cn(
          "h-5 w-5 shrink-0 flex items-center justify-center rounded",
          attr.isPrimaryKey
            ? "text-amber-500"
            : "text-muted-foreground/40 hover:text-muted-foreground"
        )}
      >
        <KeyRound className="h-3.5 w-3.5" />
      </button>

      {/* Name */}
      <Input
        defaultValue={attr.name}
        className="h-6 text-xs flex-1 min-w-0 border-transparent bg-transparent focus-visible:bg-background focus-visible:border-input px-1"
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== attr.name) onPatch({ id: attr.id, name: v });
        }}
      />

      {/* Data type */}
      <Input
        defaultValue={attr.dataType}
        className="h-6 text-[11px] w-24 border-transparent bg-transparent focus-visible:bg-background focus-visible:border-input font-mono px-1"
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== attr.dataType) onPatch({ id: attr.id, dataType: v });
        }}
      />

      {/* Nullable toggle */}
      <button
        type="button"
        onClick={() => onPatch({ id: attr.id, isNullable: !attr.isNullable })}
        className={cn(
          "h-5 px-1.5 rounded border text-[10px] font-mono font-semibold shrink-0",
          attr.isNullable
            ? "text-muted-foreground border-border"
            : "text-rose-600 border-rose-300 bg-rose-50"
        )}
        title={attr.isNullable ? "Nullable" : "NOT NULL"}
      >
        {attr.isNullable ? "NULL" : "NN"}
      </button>

      {/* Classification pill */}
      <Select
        value={attr.classification}
        onValueChange={(v) =>
          v && onPatch({ id: attr.id, classification: v as Classification })
        }
      >
        <SelectTrigger
          className="h-6 w-auto min-w-[38px] text-[10px] px-1.5 gap-1 border shrink-0"
          style={{ color: classColor, borderColor: `${classColor}55` }}
          title={`Classification: ${CLASSIFICATION_LABELS[attr.classification]}`}
        >
          <span className="font-semibold">{classLabel}</span>
        </SelectTrigger>
        <SelectContent>
          {CLASSIFICATION_OPTIONS.map((c) => (
            <SelectItem key={c} value={c}>
              {CLASSIFICATION_LABELS[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Advanced popover — regulatory tags + FK + description */}
      <Popover>
        <PopoverTrigger
          className={cn(
            "h-5 w-5 shrink-0 flex items-center justify-center rounded hover:bg-muted",
            advancedActive ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"
          )}
          title="Regulatory tags, FK, description"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3 space-y-3" align="end">
          {/* Regulatory tags */}
          <div>
            <div className="text-[10px] font-medium text-muted-foreground uppercase mb-1.5">
              Regulatory Tags
            </div>
            <div className="flex flex-wrap gap-1">
              {REGULATORY_TAG_OPTIONS.map((tag) => {
                const active = regTags.includes(tag);
                const color = REGULATORY_TAG_COLORS[tag];
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide border"
                    style={{
                      color: active ? "#fff" : color,
                      borderColor: `${color}77`,
                      background: active ? color : `${color}12`,
                    }}
                  >
                    {REGULATORY_TAG_LABELS[tag]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* FK */}
          <div>
            <div className="text-[10px] font-medium text-muted-foreground uppercase mb-1.5">
              Foreign Key
            </div>
            <label className="flex items-center gap-2 mb-1.5 cursor-pointer">
              <Checkbox
                checked={attr.isForeignKey}
                onCheckedChange={(checked) => {
                  const isChecked = checked === true;
                  onPatch({
                    id: attr.id,
                    isForeignKey: isChecked,
                    ...(isChecked ? {} : { fkTargetEntityId: null }),
                  });
                }}
              />
              <span className="text-xs">References another entity</span>
            </label>
            {attr.isForeignKey && (
              <Select
                value={attr.fkTargetEntityId ?? "__none__"}
                onValueChange={(v) =>
                  onPatch({
                    id: attr.id,
                    fkTargetEntityId: !v || v === "__none__" ? null : v,
                  })
                }
              >
                <SelectTrigger className="h-7 text-xs">
                  {attr.fkTargetEntityId
                    ? (() => {
                        const target = allEntities.find((e) => e.id === attr.fkTargetEntityId);
                        return target
                          ? `${target.domain?.name ? target.domain.name + " / " : ""}${target.name}`
                          : "Select target…";
                      })()
                    : "Select target…"}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {allEntities.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.domain?.name ? `${e.domain.name} / ` : ""}
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Description */}
          <div>
            <div className="text-[10px] font-medium text-muted-foreground uppercase mb-1.5">
              Description
            </div>
            <Textarea
              defaultValue={attr.description ?? ""}
              rows={2}
              placeholder="What does this field capture?"
              className="text-xs"
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== (attr.description ?? "")) {
                  onPatch({ id: attr.id, description: v || null });
                }
              }}
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        className="h-5 w-5 shrink-0 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition"
        title="Delete attribute"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
