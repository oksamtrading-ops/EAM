"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { DataContext, type DataViewMode } from "./DataContext";
import { DataToolbar } from "./DataToolbar";
import { DomainsView } from "./views/DomainsView";
import { EntitiesView } from "./views/EntitiesView";
import { CrudMatrixView } from "./views/CrudMatrixView";
import { ErdView } from "./views/ErdView";
import { EntityDetailPanel } from "./panels/EntityDetailPanel";
import { DomainDetailPanel } from "./panels/DomainDetailPanel";
import { DomainFormModal } from "./modals/DomainFormModal";
import { EntityFormModal } from "./modals/EntityFormModal";
import { ImportDataExcelDialog } from "./modals/ImportDataExcelDialog";

export function DataPageClient() {
  const [view, setView] = useState<DataViewMode>("entities");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [showDomainForm, setShowDomainForm] = useState(false);
  const [showEntityForm, setShowEntityForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Prefetch the shared queries used across views
  trpc.dataDomain.list.useQuery();
  trpc.dataEntity.list.useQuery();
  trpc.dataEntity.stats.useQuery();

  return (
    <DataContext.Provider
      value={{
        view,
        setView,
        selectedEntityId,
        setSelectedEntityId,
        selectedDomainId,
        setSelectedDomainId,
      }}
    >
      <div className="h-full flex flex-col min-w-0 overflow-hidden">
        <DataToolbar
          onNewDomain={() => setShowDomainForm(true)}
          onNewEntity={() => setShowEntityForm(true)}
          onImport={() => setShowImport(true)}
        />

        <div className="flex-1 overflow-hidden">
          {view === "domains" && <DomainsView />}
          {view === "entities" && <EntitiesView />}
          {view === "crud" && <CrudMatrixView />}
          {view === "erd" && <ErdView />}
        </div>
      </div>

      {selectedEntityId && (
        <EntityDetailPanel
          entityId={selectedEntityId}
          onClose={() => setSelectedEntityId(null)}
        />
      )}

      {selectedDomainId && (
        <DomainDetailPanel
          domainId={selectedDomainId}
          onClose={() => setSelectedDomainId(null)}
        />
      )}

      <DomainFormModal
        open={showDomainForm}
        onClose={() => setShowDomainForm(false)}
      />

      <EntityFormModal
        open={showEntityForm}
        onClose={() => setShowEntityForm(false)}
      />

      <ImportDataExcelDialog
        open={showImport}
        onClose={() => setShowImport(false)}
      />
    </DataContext.Provider>
  );
}
