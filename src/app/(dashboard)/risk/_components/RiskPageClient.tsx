"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { RiskContext, type ViewMode } from "./RiskContext";
import { RiskToolbar } from "./RiskToolbar";
import { TechRadarView } from "./views/TechRadarView";
import { RiskHeatMapView } from "./views/RiskHeatMapView";
import { EolTimelineView } from "./views/EolTimelineView";
import { ComplianceView } from "./views/ComplianceView";
import { RiskDetailPanel } from "./panels/RiskDetailPanel";
import { RiskFormModal } from "./modals/RiskFormModal";

export function RiskPageClient() {
  const [view, setView] = useState<ViewMode>("radar");
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);
  const [showCreateRisk, setShowCreateRisk] = useState(false);

  const { data: risks = [] } = trpc.risk.list.useQuery();
  const { data: stats } = trpc.risk.getStats.useQuery();
  const { data: radar } = trpc.techRadar.getRadar.useQuery();
  const { data: eolList = [] } = trpc.eol.list.useQuery();
  const { data: scorecard = [] } = trpc.compliance.getScorecard.useQuery();

  return (
    <RiskContext.Provider
      value={{
        view,
        setView,
        risks,
        stats,
        radar,
        eolList,
        scorecard,
        selectedRiskId,
        setSelectedRiskId,
      }}
    >
      <div className="h-full flex flex-col min-w-0 overflow-hidden">
        <RiskToolbar onNewRisk={() => setShowCreateRisk(true)} />

        <div className="flex-1 overflow-hidden">
          {view === "radar" && <TechRadarView />}
          {view === "heatmap" && <RiskHeatMapView onSelectRisk={setSelectedRiskId} />}
          {view === "eol" && <EolTimelineView />}
          {view === "compliance" && <ComplianceView />}
        </div>
      </div>

      {selectedRiskId && (
        <RiskDetailPanel
          riskId={selectedRiskId}
          onClose={() => setSelectedRiskId(null)}
        />
      )}

      <RiskFormModal
        open={showCreateRisk}
        onClose={() => setShowCreateRisk(false)}
      />
    </RiskContext.Provider>
  );
}
