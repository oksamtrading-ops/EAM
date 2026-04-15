"use client";

import { createContext, useContext } from "react";

export type DataViewMode = "domains" | "entities" | "crud" | "erd";

type DataContextValue = {
  view: DataViewMode;
  setView: (v: DataViewMode) => void;
  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;
  selectedDomainId: string | null;
  setSelectedDomainId: (id: string | null) => void;
};

export const DataContext = createContext<DataContextValue | null>(null);

export function useDataContext() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useDataContext must be used within DataContext.Provider");
  return ctx;
}
