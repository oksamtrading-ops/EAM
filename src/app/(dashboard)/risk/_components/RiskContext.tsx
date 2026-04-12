"use client";

import { createContext, useContext } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";

type RouterOutput = inferRouterOutputs<AppRouter>;

export type RiskList = RouterOutput["risk"]["list"];
export type RiskItem = RiskList[number];
export type RadarData = RouterOutput["techRadar"]["getRadar"];
export type EolList = RouterOutput["eol"]["list"];
export type Scorecard = RouterOutput["compliance"]["getScorecard"];
export type RiskStats = RouterOutput["risk"]["getStats"];

export type ViewMode = "radar" | "heatmap" | "eol" | "compliance";

type RiskContextValue = {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  risks: RiskList;
  stats: RiskStats | undefined;
  radar: RadarData | undefined;
  eolList: EolList;
  scorecard: Scorecard;
  selectedRiskId: string | null;
  setSelectedRiskId: (id: string | null) => void;
};

export const RiskContext = createContext<RiskContextValue>({
  view: "radar",
  setView: () => {},
  risks: [],
  stats: undefined,
  radar: undefined,
  eolList: [],
  scorecard: [],
  selectedRiskId: null,
  setSelectedRiskId: () => {},
});

export function useRiskContext() {
  return useContext(RiskContext);
}
