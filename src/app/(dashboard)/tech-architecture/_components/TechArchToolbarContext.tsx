"use client";

import { createContext, useContext } from "react";

export type TechArchToolbarContextValue = {
  /** Mount point for active tab's filter + create buttons. Null until toolbar is mounted. */
  actionsEl: HTMLElement | null;
};

export const TechArchToolbarContext = createContext<TechArchToolbarContextValue>({
  actionsEl: null,
});

export function useTechArchToolbar(): TechArchToolbarContextValue {
  return useContext(TechArchToolbarContext);
}
