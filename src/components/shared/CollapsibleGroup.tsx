"use client";

import { createContext, useContext, useState } from "react";

type CollapsibleGroupContextValue = {
  openId: string | null;
  toggle: (id: string) => void;
};

const CollapsibleGroupContext = createContext<CollapsibleGroupContextValue | null>(null);

export function useCollapsibleGroup(): CollapsibleGroupContextValue | null {
  return useContext(CollapsibleGroupContext);
}

type Props = {
  defaultOpenId?: string | null;
  children: React.ReactNode;
};

export function CollapsibleGroup({ defaultOpenId = null, children }: Props) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId);
  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <CollapsibleGroupContext.Provider value={{ openId, toggle }}>
      {children}
    </CollapsibleGroupContext.Provider>
  );
}
