"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight, Plus, CheckCircle2, AlertCircle, MinusCircle, HelpCircle } from "lucide-react";
import { useRiskContext } from "../RiskContext";
import { FrameworkImportModal } from "../modals/FrameworkImportModal";
import { ComplianceMappingPanel } from "../panels/ComplianceMappingPanel";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  COMPLIANT:     { icon: CheckCircle2,  color: "text-green-600",  bg: "bg-green-50" },
  PARTIAL:       { icon: MinusCircle,   color: "text-yellow-600", bg: "bg-yellow-50" },
  NON_COMPLIANT: { icon: AlertCircle,   color: "text-red-600",    bg: "bg-red-50" },
  NOT_ASSESSED:  { icon: HelpCircle,    color: "text-gray-400",   bg: "bg-gray-50" },
  EXEMPT:        { icon: CheckCircle2,  color: "text-blue-500",   bg: "bg-blue-50" },
};

const FRAMEWORK_LABELS: Record<string, string> = {
  SOC2_TYPE2: "SOC 2 Type II",
  ISO_27001: "ISO 27001",
  GDPR: "GDPR",
  PCI_DSS: "PCI-DSS",
  HIPAA: "HIPAA",
  NIST_CSF: "NIST CSF",
  CIS_CONTROLS: "CIS Controls",
  SOX: "SOX",
  PIPEDA: "PIPEDA",
  CUSTOM: "Custom",
};

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold">{score}%</span>
    </div>
  );
}

export function ComplianceView() {
  const { scorecard } = useRiskContext();
  const [showImport, setShowImport] = useState(false);
  const [expandedFramework, setExpandedFramework] = useState<string | null>(null);
  const [selectedControl, setSelectedControl] = useState<{ requirementId: string; controlTitle: string } | null>(null);

  const { data: importedFrameworks = [] } = trpc.compliance.getImportedFrameworks.useQuery();
  const { data: requirements = [] } = trpc.compliance.listRequirements.useQuery(
    { framework: expandedFramework as any },
    { enabled: !!expandedFramework }
  );

  const frameworkSet = new Set(importedFrameworks.map((f) => f.framework));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <h2 className="text-base font-semibold">Compliance Register</h2>
        <Button
          size="sm"
          className="gap-1.5 bg-[#0B5CD6] hover:bg-[#094cb0] text-white"
          onClick={() => setShowImport(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Import Framework
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-4">
          {/* Scorecard grid */}
          {scorecard.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              {scorecard.map((fw) => (
                <div key={fw.framework} data-slot="card" className="bg-white rounded-xl border p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">{FRAMEWORK_LABELS[fw.framework] ?? fw.framework}</span>
                    <ScoreBar score={fw.score} />
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span className="text-green-600">{fw.compliant} compliant</span>
                    <span className="text-yellow-600">{fw.partial} partial</span>
                    <span className="text-red-600">{fw.nonCompliant} non-compliant</span>
                    <span>{fw.notAssessed} not assessed</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Framework accordion */}
          {importedFrameworks.map((fw) => {
            const isExpanded = expandedFramework === fw.framework;
            const fwScorecard = scorecard.find((s) => s.framework === fw.framework);
            return (
              <div key={fw.framework} data-slot="card" className="border rounded-xl overflow-hidden bg-white">
                <button
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
                  onClick={() =>
                    setExpandedFramework(isExpanded ? null : fw.framework)
                  }
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-sm font-semibold">{FRAMEWORK_LABELS[fw.framework] ?? fw.framework}</span>
                    <Badge variant="outline" className="text-[11px]">{fw.count} controls</Badge>
                  </div>
                  {fwScorecard && <ScoreBar score={fwScorecard.score} />}
                </button>

                {isExpanded && (
                  <div className="border-t divide-y">
                    {requirements.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-muted-foreground">Loading controls…</p>
                    ) : (
                      requirements.map((req) => {
                        const worstStatus =
                          req.mappings.length === 0 ? "NOT_ASSESSED"
                          : req.mappings.every((m) => m.status === "COMPLIANT") ? "COMPLIANT"
                          : req.mappings.some((m) => m.status === "NON_COMPLIANT") ? "NON_COMPLIANT"
                          : req.mappings.some((m) => m.status === "PARTIAL") ? "PARTIAL"
                          : req.mappings.every((m) => m.status === "EXEMPT") ? "EXEMPT"
                          : "NOT_ASSESSED";

                        const cfg = STATUS_CONFIG[worstStatus] ?? STATUS_CONFIG.NOT_ASSESSED;
                        const Icon = cfg.icon;

                        return (
                          <button
                            key={req.id}
                            className="w-full flex items-start gap-3 px-5 py-3 hover:bg-muted/30 transition-colors text-left"
                            onClick={() =>
                              setSelectedControl({ requirementId: req.id, controlTitle: req.title })
                            }
                          >
                            <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", cfg.color)} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono text-muted-foreground">{req.controlId}</span>
                                <span className="text-[13px] font-medium truncate">{req.title}</span>
                              </div>
                              {req.category && (
                                <span className="text-[10px] text-muted-foreground">{req.category}</span>
                              )}
                            </div>
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] h-5 shrink-0", cfg.bg, cfg.color)}
                            >
                              {worstStatus.replace(/_/g, " ")}
                            </Badge>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {importedFrameworks.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No compliance frameworks imported yet.</p>
              <p className="text-xs mt-1">Import SOC 2, ISO 27001, GDPR, and more to start tracking.</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {showImport && <FrameworkImportModal onClose={() => setShowImport(false)} />}

      {selectedControl && (
        <ComplianceMappingPanel
          requirementId={selectedControl.requirementId}
          controlTitle={selectedControl.controlTitle}
          onClose={() => setSelectedControl(null)}
        />
      )}
    </div>
  );
}
