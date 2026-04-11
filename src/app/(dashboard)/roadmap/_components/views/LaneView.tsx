"use client";

import { useMemo } from "react";
import { useRoadmapContext } from "../RoadmapContext";
import { InitiativeChip } from "../shared/InitiativeChip";
import { HorizonBadge } from "../shared/HorizonBadge";

const HORIZONS = ["H1_NOW", "H2_NEXT", "H3_LATER"] as const;

type CapabilityNode = { id: string; name: string; level: string; children?: CapabilityNode[] };

function findL1Domain(
  capabilityId: string | undefined,
  capabilities: CapabilityNode[]
): string | null {
  if (!capabilityId) return null;

  function findById(id: string, nodes: CapabilityNode[]): CapabilityNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      const found = findById(id, n.children ?? []);
      if (found) return found;
    }
    return null;
  }

  // Build flat map for parent lookups
  const flat: CapabilityNode[] = [];
  function flatten(nodes: CapabilityNode[]) {
    for (const n of nodes) {
      flat.push(n);
      flatten(n.children ?? []);
    }
  }
  flatten(capabilities);

  const cap = flat.find((c) => c.id === capabilityId);
  if (!cap) return null;
  if (cap.level === "L1") return cap.id;

  // Walk up to find L1
  const l1 = capabilities.find((c) => {
    function containsId(node: CapabilityNode, id: string): boolean {
      if (node.id === id) return true;
      return (node.children ?? []).some((ch) => containsId(ch, id));
    }
    return c.level === "L1" && containsId(c, capabilityId);
  });
  return l1?.id ?? null;
}

export function LaneView() {
  const { roadmap, capabilities, setSelectedId } = useRoadmapContext();
  const { initiatives } = roadmap ?? {};

  const l1Domains = useMemo(
    () => (capabilities ?? []).filter((c: CapabilityNode) => c.level === "L1"),
    [capabilities]
  );

  const initiativesByDomain = useMemo(() => {
    const map = new Map<string, typeof initiatives>([["uncategorised", []]]);
    l1Domains.forEach((d: CapabilityNode) => map.set(d.id, []));

    initiatives?.forEach((initiative) => {
      const firstCapId = (initiative.capabilities as any[])?.[0]?.capabilityId;
      const domainId = findL1Domain(firstCapId, capabilities ?? []);
      const bucket = map.get(domainId ?? "uncategorised") ?? [];
      bucket.push(initiative as any);
      map.set(domainId ?? "uncategorised", bucket);
    });
    return map;
  }, [initiatives, l1Domains, capabilities]);

  if (!initiatives) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  const domains = [
    ...l1Domains,
    { id: "uncategorised", name: "Uncategorised", level: "L1" },
  ];

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="flex border-b sticky top-0 bg-background z-10">
        <div className="w-56 shrink-0 p-2 font-semibold text-xs border-r text-muted-foreground uppercase tracking-wide">
          Capability Domain
        </div>
        {HORIZONS.map((h) => (
          <div
            key={h}
            className="flex-1 p-2 text-center border-r flex items-center justify-center"
          >
            <HorizonBadge horizon={h} />
          </div>
        ))}
      </div>

      {/* Domain rows */}
      {domains.map((domain) => {
        const domainInitiatives = initiativesByDomain.get(domain.id) ?? [];
        return (
          <div key={domain.id} className="flex border-b min-h-[80px]">
            <div className="w-56 shrink-0 p-3 text-xs font-medium border-r flex items-start text-gray-700">
              {domain.name}
            </div>
            {HORIZONS.map((horizon) => (
              <div
                key={horizon}
                className="flex-1 p-2 border-r flex flex-wrap gap-1 items-start content-start min-h-[80px] bg-muted/10"
              >
                {domainInitiatives
                  .filter((i) => (i as any).horizon === horizon)
                  .map((i) => (
                    <InitiativeChip
                      key={(i as any).id}
                      initiative={i as any}
                      onClick={() => setSelectedId((i as any).id)}
                    />
                  ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
