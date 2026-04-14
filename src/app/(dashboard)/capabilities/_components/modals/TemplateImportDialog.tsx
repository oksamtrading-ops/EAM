"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, CheckSquare, Square, Minus } from "lucide-react";

// ── Band metadata ────────────────────────────────────────────────────────────
const BANDS: Record<string, { color: string; label: string; description: string }> = {
  Grow:    { color: "#0B5CD6", label: "Grow",    description: "Revenue-facing: Sales, Marketing, Product, Customer Service, R&D" },
  Run:     { color: "#3b82f6", label: "Run",     description: "Operations: Manufacturing, Supply Chain, HR, Procurement, Service Delivery" },
  Protect: { color: "#f59e0b", label: "Protect", description: "Governance: Finance, GRC, Strategy, Trade Compliance, Sustainability" },
};

const IMPORTANCE_COLORS: Record<string, string> = {
  CRITICAL:     "bg-red-100 text-red-700",
  HIGH:         "bg-orange-100 text-orange-700",
  MEDIUM:       "bg-yellow-100 text-yellow-700",
  LOW:          "bg-slate-100 text-slate-600",
  NOT_ASSESSED: "bg-slate-100 text-slate-400",
};

const IMPORTANCE_LABELS: Record<string, string> = {
  CRITICAL:     "Critical",
  HIGH:         "High",
  MEDIUM:       "Medium",
  LOW:          "Low",
  NOT_ASSESSED: "—",
};

// ── Industry list ────────────────────────────────────────────────────────────
// NOTE: industries marked "templatesAvailable: false" do not yet have L1/L2
// capability templates seeded. They appear in the list but with a disabled
// state and a "Templates coming soon" badge.
const INDUSTRIES = [
  { value: "BANKING",              label: "Banking & Financial Services",  icon: "🏦", templatesAvailable: true },
  { value: "INSURANCE",            label: "Insurance",                     icon: "🛡️", templatesAvailable: true },
  { value: "RETAIL",               label: "Retail & Consumer",             icon: "🛒", templatesAvailable: true },
  { value: "LOGISTICS",            label: "Logistics & Supply Chain",      icon: "🚚", templatesAvailable: true },
  { value: "MANUFACTURING",        label: "Manufacturing",                 icon: "🏭", templatesAvailable: true },
  { value: "HEALTHCARE",           label: "Healthcare",                    icon: "🏥", templatesAvailable: true },
  { value: "PHARMA_LIFESCIENCES",  label: "Pharma & Life Sciences",        icon: "💊", templatesAvailable: true },
  { value: "TELECOM",              label: "Telecommunications",            icon: "📡", templatesAvailable: true },
  { value: "ENERGY_UTILITIES",     label: "Energy & Utilities",            icon: "⚡", templatesAvailable: true },
  { value: "PUBLIC_SECTOR",        label: "Public Sector",                 icon: "🏛️", templatesAvailable: true },
  { value: "GENERIC",              label: "Generic / Cross-Industry",      icon: "🔲", templatesAvailable: true },
  { value: "ENTERPRISE_BCM",       label: "Enterprise BCM (Comprehensive)", icon: "🌐", templatesAvailable: true },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
};

// ── Component ────────────────────────────────────────────────────────────────
export function TemplateImportDialog({ open, onClose }: Props) {
  const utils = trpc.useUtils();

  // Step 1 state
  const [step, setStep]                     = useState<1 | 2>(1);
  const [selectedIndustry, setSelectedIndustry] = useState<string>("");
  const [replaceExisting, setReplaceExisting]   = useState(false);
  const [includeL3, setIncludeL3]               = useState(false);

  // Step 2 state
  const [selectedDomains, setSelectedDomains]   = useState<Set<string>>(new Set());
  const [activeBandFilters, setActiveBandFilters] = useState<Set<string>>(
    new Set(Object.keys(BANDS))
  );

  const isEnterprise = selectedIndustry === "ENTERPRISE_BCM";

  // ── Fetch domains ──────────────────────────────────────────────────────────
  const { data: domains = [], isLoading: domainsLoading } =
    trpc.capability.getTemplateDomains.useQuery(
      { industry: selectedIndustry as any },
      { enabled: isEnterprise && step === 2 }
    );

  // Pre-select all domains when loaded
  useEffect(() => {
    if (domains.length > 0) {
      setSelectedDomains(new Set(domains.map((d) => d.code)));
    }
  }, [domains]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedIndustry("");
      setReplaceExisting(false);
      setIncludeL3(false);
      setSelectedDomains(new Set());
      setActiveBandFilters(new Set(Object.keys(BANDS)));
    }
  }, [open]);

  // ── Mutation ───────────────────────────────────────────────────────────────
  const importMutation = trpc.capability.importFromTemplate.useMutation({
    onSuccess: (data) => {
      utils.capability.getTree.invalidate();
      toast.success(`Imported ${data.imported} capabilities`);
      onClose();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const visibleDomains = domains.filter(
    (d) => !d.band || activeBandFilters.has(d.band)
  );

  const groupedByBand = Object.keys(BANDS).reduce<
    Record<string, typeof domains>
  >((acc, band) => {
    acc[band] = domains.filter((d) => d.band === band);
    return acc;
  }, {});

  // Band-level selection state: all / some / none
  function bandSelectionState(band: string): "all" | "some" | "none" {
    const bandDomains = groupedByBand[band] ?? [];
    if (bandDomains.length === 0) return "none";
    const selectedCount = bandDomains.filter((d) => selectedDomains.has(d.code)).length;
    if (selectedCount === 0)               return "none";
    if (selectedCount === bandDomains.length) return "all";
    return "some";
  }

  function toggleBand(band: string) {
    const bandDomains = groupedByBand[band] ?? [];
    const state = bandSelectionState(band);
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      if (state === "all") {
        bandDomains.forEach((d) => next.delete(d.code));
      } else {
        bandDomains.forEach((d) => next.add(d.code));
      }
      return next;
    });
  }

  function toggleDomain(code: string) {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  function selectAll()  { setSelectedDomains(new Set(domains.map((d) => d.code))); }
  function clearAll()   { setSelectedDomains(new Set()); }

  // Estimated capability count for the button label
  const estimatedCaps = domains
    .filter((d) => selectedDomains.has(d.code))
    .reduce(
      (sum, d) => sum + 1 + d.l2Count + (includeL3 ? d.l3Count : 0),
      0
    );

  // ── Import handler ─────────────────────────────────────────────────────────
  function handleImport() {
    importMutation.mutate({
      industry: selectedIndustry as any,
      levels: includeL3 ? ["L1", "L2", "L3"] : ["L1", "L2"],
      replaceExisting,
      domainCodes: isEnterprise ? Array.from(selectedDomains) : undefined,
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={
          step === 2
            ? "sm:max-w-2xl max-h-[90vh] flex flex-col"
            : "sm:max-w-lg"
        }
      >
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Import Industry Template" : "Select Domains to Import"}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Select an industry to import a pre-built capability map. You can customize it after import."
              : "Choose which domains to include. Uncheck domains you don't need."}
          </DialogDescription>
        </DialogHeader>

        {/* ── STEP 1: Template selection ──────────────────────────────────── */}
        {step === 1 && (
          <>
            <div className="grid grid-cols-2 gap-2 my-3 max-h-[60vh] overflow-y-auto pr-1">
              {INDUSTRIES.map((ind) => {
                const disabled = !ind.templatesAvailable;
                return (
                  <button
                    key={ind.value}
                    onClick={() => !disabled && setSelectedIndustry(ind.value)}
                    disabled={disabled}
                    className={`relative flex items-center gap-2.5 px-3 py-2.5 border rounded-lg text-left transition-all ${
                      disabled
                        ? "opacity-60 cursor-not-allowed"
                        : "hover:border-primary/50"
                    } ${
                      selectedIndustry === ind.value
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    } ${ind.value === "ENTERPRISE_BCM" ? "col-span-2" : ""}`}
                  >
                    <span className="text-lg shrink-0">{ind.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{ind.label}</p>
                      {ind.value === "ENTERPRISE_BCM" && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                          18 domains · 600+ caps · Grow / Run / Protect bands
                        </p>
                      )}
                    </div>
                    {disabled && (
                      <span className="text-[10px] bg-[#f2f2f7] text-[#86868b] font-semibold px-1.5 py-0.5 rounded-full shrink-0">
                        Soon
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              {!isEnterprise && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="rounded"
                  />
                  Replace existing capabilities (caution: removes current map)
                </label>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              {isEnterprise ? (
                <Button
                  disabled={!selectedIndustry}
                  onClick={() => setStep(2)}
                >
                  Configure Domains
                  <ChevronRight className="ml-1.5 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleImport}
                  disabled={!selectedIndustry || importMutation.isPending}
                >
                  {importMutation.isPending ? "Importing..." : "Import Template"}
                </Button>
              )}
            </div>
          </>
        )}

        {/* ── STEP 2: Domain picker (Enterprise BCM only) ─────────────────── */}
        {step === 2 && (
          <>
            {/* Band filter toggles */}
            <div className="flex gap-2 mt-2 mb-3">
              {Object.entries(BANDS).map(([band, meta]) => (
                <button
                  key={band}
                  onClick={() =>
                    setActiveBandFilters((prev) => {
                      const next = new Set(prev);
                      next.has(band) ? next.delete(band) : next.add(band);
                      return next;
                    })
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    activeBandFilters.has(band)
                      ? "border-transparent text-white"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                  style={
                    activeBandFilters.has(band)
                      ? { backgroundColor: meta.color }
                      : {}
                  }
                >
                  {meta.label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-primary hover:underline"
                >
                  Select all
                </button>
                <span className="text-muted-foreground text-xs">·</span>
                <button
                  onClick={clearAll}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Clear all
                </button>
              </div>
            </div>

            {/* Domain list */}
            <div className="flex-1 overflow-y-auto border rounded-lg divide-y min-h-0">
              {domainsLoading ? (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                  Loading domains…
                </div>
              ) : (
                Object.entries(BANDS).map(([band, meta]) => {
                  const bandDomains = (groupedByBand[band] ?? []).filter(
                    (d) => activeBandFilters.has(band)
                  );
                  if (bandDomains.length === 0) return null;
                  const bState = bandSelectionState(band);

                  return (
                    <div key={band}>
                      {/* Band header row */}
                      <button
                        onClick={() => toggleBand(band)}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                      >
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        {bState === "all" ? (
                          <CheckSquare className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        ) : bState === "some" ? (
                          <Minus className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-foreground">
                          {meta.label}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          {meta.description}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {bandDomains.filter((d) => selectedDomains.has(d.code)).length}/
                          {bandDomains.length}
                        </span>
                      </button>

                      {/* Domain rows */}
                      {bandDomains.map((domain) => (
                        <button
                          key={domain.code}
                          onClick={() => toggleDomain(domain.code)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors ${
                            selectedDomains.has(domain.code) ? "" : "opacity-50"
                          }`}
                        >
                          {selectedDomains.has(domain.code) ? (
                            <CheckSquare className="h-4 w-4 text-primary flex-shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium flex-1 min-w-0 truncate">
                            {domain.name}
                          </span>
                          {domain.strategicImportance !== "NOT_ASSESSED" && (
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                                IMPORTANCE_COLORS[domain.strategicImportance] ?? ""
                              }`}
                            >
                              {IMPORTANCE_LABELS[domain.strategicImportance]}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {domain.l2Count} L2s
                            {includeL3 && domain.l3Count > 0
                              ? ` · ${domain.l3Count} L3s`
                              : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })
              )}
            </div>

            {/* Options row */}
            <div className="flex flex-col gap-2 pt-3 border-t">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeL3}
                  onChange={(e) => setIncludeL3(e.target.checked)}
                  className="rounded"
                />
                <span>
                  Include L3 sub-capabilities{" "}
                  <span className="text-muted-foreground">
                    (Finance, HR, Procurement, Manufacturing, GRC, Customer Service — adds ~65 entries)
                  </span>
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="rounded"
                />
                Replace existing capabilities{" "}
                <span className="text-muted-foreground">(caution: removes current map)</span>
              </label>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-1.5 h-4 w-4" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={
                    selectedDomains.size === 0 || importMutation.isPending
                  }
                >
                  {importMutation.isPending
                    ? "Importing…"
                    : `Import ${selectedDomains.size} domain${selectedDomains.size !== 1 ? "s" : ""} (~${estimatedCaps} capabilities)`}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
