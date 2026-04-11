"use client";

import { createContext, useContext } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";

type RouterOutput = inferRouterOutputs<AppRouter>;
type RoadmapData = RouterOutput["initiative"]["getRoadmapData"] | undefined;
type ObjectiveList = RouterOutput["objective"]["list"] | undefined;
type CapabilityTree = RouterOutput["capability"]["getTree"] | undefined;

type RoadmapContextValue = {
  roadmap: RoadmapData;
  objectives: ObjectiveList;
  capabilities: CapabilityTree;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
};

export const RoadmapContext = createContext<RoadmapContextValue>({
  roadmap: undefined,
  objectives: undefined,
  capabilities: undefined,
  selectedId: null,
  setSelectedId: () => {},
});

export function useRoadmapContext() {
  return useContext(RoadmapContext);
}
