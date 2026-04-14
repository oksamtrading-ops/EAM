"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import { DollarSign, TrendingUp, AlertTriangle } from "lucide-react";

type Props = {
  tree: any[];
  onSelect: (id: string) => void;
};

export function InvestmentChart({ tree, onSelect }: Props) {
  const { data: costRollup, isLoading } = trpc.capability.getCostRollup.useQuery();

  // Build L1-level cost summary (aggregate child costs up)
  const l1Data = useMemo(() => {
    if (!costRollup || !tree.length) return [];

    function sumCosts(node: any): number {
      const own = costRollup?.[node.id]?.totalCost ?? 0;
      const childrenSum = (node.children ?? []).reduce(
        (acc: number, c: any) => acc + sumCosts(c),
        0
      );
      return own + childrenSum;
    }

    return tree
      .map((l1) => ({
        id: l1.id,
        name: l1.name,
        totalCost: sumCosts(l1),
        directCost: costRollup[l1.id]?.totalCost ?? 0,
        appCount: costRollup?.[l1.id]?.appCount ?? 0,
        childCount: (l1.children ?? []).length,
        children: (l1.children ?? [])
          .map((l2: any) => ({
            id: l2.id,
            name: l2.name,
            cost: sumCosts(l2),
            appCount: costRollup?.[l2.id]?.appCount ?? 0,
          }))
          .filter((c: any) => c.cost > 0)
          .sort((a: any, b: any) => b.cost - a.cost),
      }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [costRollup, tree]);

  const grandTotal = l1Data.reduce((sum, d) => sum + d.totalCost, 0);
  const maxCost = l1Data[0]?.totalCost ?? 1;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading investment data...
      </div>
    );
  }

  if (grandTotal === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <DollarSign className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground mb-1">No cost data available</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Add annual cost data to applications and map them to capabilities to see investment breakdown.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          icon={<DollarSign className="h-4 w-4 text-[#0B5CD6]" />}
          label="Total Investment"
          value={`$${grandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub="Annual weighted cost"
        />
        <SummaryCard
          icon={<TrendingUp className="h-4 w-4 text-[#16a34a]" />}
          label="Capabilities with Cost"
          value={String(l1Data.filter((d) => d.totalCost > 0).length)}
          sub={`of ${l1Data.length} L1 domains`}
        />
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
          label="Unfunded"
          value={String(l1Data.filter((d) => d.totalCost === 0).length)}
          sub="L1 domains with $0"
        />
      </div>

      {/* Bar chart */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="text-sm font-semibold text-[#1a1f2e] mb-4">
          Investment by Capability Domain
        </h3>
        <div className="space-y-3">
          {l1Data.map((d) => {
            const pct = maxCost > 0 ? (d.totalCost / maxCost) * 100 : 0;
            const sharePct = grandTotal > 0 ? (d.totalCost / grandTotal) * 100 : 0;
            return (
              <div
                key={d.id}
                className="group cursor-pointer"
                onClick={() => onSelect(d.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[#1a1f2e] group-hover:text-[#0B5CD6] transition">
                    {d.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">
                      {sharePct.toFixed(1)}%
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-[#1a1f2e]">
                      ${d.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
                <div className="h-6 bg-[#f1f3f5] rounded-md overflow-hidden relative">
                  <div
                    className="h-full rounded-md bg-gradient-to-r from-[#0B5CD6] to-[#3b82f6] transition-all duration-300 group-hover:from-[#094cb0] group-hover:to-[#0B5CD6]"
                    style={{ width: `${Math.max(pct, 0.5)}%` }}
                  />
                  {/* Sub-segments for L2 children */}
                  {d.children.length > 0 && pct > 10 && (
                    <div className="absolute inset-0 flex">
                      {d.children.slice(0, 5).map((child: any, i: number) => {
                        const childPct = d.totalCost > 0 ? (child.cost / d.totalCost) * pct : 0;
                        return (
                          <div
                            key={child.id}
                            className="h-full border-r border-white/30"
                            style={{
                              width: `${childPct}%`,
                              opacity: 0.7 - i * 0.1,
                            }}
                            title={`${child.name}: $${child.cost.toLocaleString()}`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* L2 breakdown on hover */}
                {d.children.length > 0 && (
                  <div className="hidden group-hover:block mt-1.5 pl-4 space-y-0.5">
                    {d.children.slice(0, 4).map((child: any) => (
                      <div key={child.id} className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground truncate">{child.name}</span>
                        <span className="text-[#1a1f2e] tabular-nums font-medium ml-2">
                          ${child.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    ))}
                    {d.children.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{d.children.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-bold text-[#1a1f2e]">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}
