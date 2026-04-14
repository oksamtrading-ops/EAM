"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Building2, Globe, Scale, Lightbulb, Eye } from "lucide-react";

const INDUSTRIES = [
  { value: "BANKING", label: "Banking & Financial Services" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "RETAIL", label: "Retail & Consumer" },
  { value: "LOGISTICS", label: "Logistics & Supply Chain" },
  { value: "MANUFACTURING", label: "Manufacturing" },
  { value: "HEALTHCARE", label: "Healthcare" },
  { value: "PHARMA_LIFESCIENCES", label: "Pharma & Life Sciences" },
  { value: "TELECOM", label: "Telecommunications" },
  { value: "ENERGY_UTILITIES", label: "Energy & Utilities" },
  { value: "PUBLIC_SECTOR", label: "Public Sector" },
  { value: "GENERIC", label: "Generic / Cross-Industry" },
  { value: "ENTERPRISE_BCM", label: "Enterprise BCM" },
];

const SUB_INDUSTRY_HINTS: Record<string, string[]> = {
  BANKING: ["Retail Banking", "Commercial Banking", "Investment Banking", "Private Banking", "Neobank", "Credit Union"],
  INSURANCE: ["Property & Casualty", "Life", "Health", "Reinsurance", "Insurtech", "Specialty Lines"],
  RETAIL: ["Grocery", "Apparel", "Electronics", "E-commerce Pure-Play", "Omnichannel", "Luxury"],
  LOGISTICS: ["Freight Forwarding", "Last-Mile Delivery", "3PL", "Maritime Shipping", "Rail Logistics"],
  MANUFACTURING: ["Automotive", "Aerospace", "Chemicals", "Industrial Equipment", "Consumer Goods"],
  HEALTHCARE: ["Provider", "Payer", "MedTech", "Digital Health", "Academic Medical Center"],
  PHARMA_LIFESCIENCES: ["Big Pharma", "Biotech", "Medical Devices", "CRO/CDMO", "Diagnostics"],
  TELECOM: ["Mobile Operator", "Fixed-line", "Cable/Broadband", "MVNO", "Satellite", "Tower Infrastructure"],
  ENERGY_UTILITIES: ["Power Generation", "Transmission & Distribution", "Natural Gas", "Water", "Renewables", "Oil & Gas"],
  PUBLIC_SECTOR: ["Federal Government", "State & Local", "Defense", "Public Healthcare", "Education (Gov)", "Tax & Social Services"],
  GENERIC: ["Technology", "Professional Services", "Media", "Education", "Non-Profit"],
  ENTERPRISE_BCM: ["Business Continuity", "Crisis Management", "Operational Resilience"],
};

const REGIONS = [
  { value: "NA", label: "North America" },
  { value: "EMEA", label: "EMEA" },
  { value: "APAC", label: "APAC" },
  { value: "LATAM", label: "Latin America" },
  { value: "GLOBAL", label: "Global" },
];

export function OverviewTab() {
  const { workspaceId } = useWorkspace();
  const { data: workspace, isLoading } = trpc.workspace.getOrCreate.useQuery();
  const utils = trpc.useUtils();

  const [industry, setIndustry] = useState("GENERIC");
  const [subIndustry, setSubIndustry] = useState("");
  const [region, setRegion] = useState<string>("");
  const [regulatoryRegime, setRegulatoryRegime] = useState("");
  const [businessModelHint, setBusinessModelHint] = useState("");
  const [missionStatement, setMissionStatement] = useState("");
  const [itVision, setItVision] = useState("");

  useEffect(() => {
    if (workspace) {
      setIndustry(workspace.industry);
      setSubIndustry((workspace as any).subIndustry ?? "");
      setRegion((workspace as any).region ?? "");
      setRegulatoryRegime((workspace as any).regulatoryRegime ?? "");
      setBusinessModelHint((workspace as any).businessModelHint ?? "");
      setMissionStatement((workspace as any).missionStatement ?? "");
      setItVision((workspace as any).itVision ?? "");
    }
  }, [workspace]);

  const updateMutation = trpc.workspace.update.useMutation({
    onSuccess: () => {
      utils.workspace.getOrCreate.invalidate();
      toast.success("Organization profile saved");
    },
    onError: (err) => toast.error(err.message),
  });

  const subIndustryHints = SUB_INDUSTRY_HINTS[industry] ?? [];

  if (isLoading) {
    return (
      <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Industry */}
      <div className="bg-white rounded-xl border p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-[#1a1f2e]">Industry</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Primary Industry</Label>
            <Select
              value={industry}
              onValueChange={(v) => setIndustry(v ?? "GENERIC")}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((ind) => (
                  <SelectItem key={ind.value} value={ind.value}>
                    {ind.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">Sub-industry</Label>
            <Input
              value={subIndustry}
              onChange={(e) => setSubIndustry(e.target.value)}
              placeholder="e.g. Retail Banking, Neobank"
              className="mt-1.5"
            />
            {subIndustryHints.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {subIndustryHints.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setSubIndustry(h)}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-[#7c3aed]/30 text-[#7c3aed] hover:bg-[#7c3aed]/5 transition"
                  >
                    {h}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Geography & regulation */}
      <div className="bg-white rounded-xl border p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-[#1a1f2e]">
            Geography & Regulation
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Primary Region</Label>
            <Select
              value={region || "__none__"}
              onValueChange={(v) => setRegion(v === "__none__" ? "" : v ?? "")}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Not specified</SelectItem>
                {REGIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5" />
              Regulatory Regime
            </Label>
            <Input
              value={regulatoryRegime}
              onChange={(e) => setRegulatoryRegime(e.target.value)}
              placeholder="e.g. US/EU dual, UK FCA, APAC"
              className="mt-1.5"
            />
          </div>
        </div>
      </div>

      {/* Business model & mission */}
      <div className="bg-white rounded-xl border p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-[#1a1f2e]">
            Business Model
          </h2>
        </div>

        <div>
          <Label className="text-sm font-medium">Business model hint</Label>
          <Textarea
            value={businessModelHint}
            onChange={(e) => setBusinessModelHint(e.target.value)}
            placeholder="1-3 sentences. e.g. 'Digital-first mortgage lender focused on millennials in the US Northeast. Partners with fintech ecosystems and prioritizes API-led architecture.'"
            rows={3}
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            This is the single highest-leverage field for AI quality. Be
            specific about what makes your organization distinct.
          </p>
        </div>

        <div>
          <Label className="text-sm font-medium">Mission Statement</Label>
          <Textarea
            value={missionStatement}
            onChange={(e) => setMissionStatement(e.target.value)}
            placeholder="Your organization's mission — what you exist to do and for whom."
            rows={2}
            className="mt-1.5"
          />
        </div>
      </div>

      {/* IT Vision */}
      <div className="bg-white rounded-xl border p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-[#1a1f2e]">IT Vision</h2>
        </div>

        <div>
          <Label className="text-sm font-medium">
            IT Vision & Strategy
          </Label>
          <Textarea
            value={itVision}
            onChange={(e) => setItVision(e.target.value)}
            placeholder="Describe your target IT operating model and technology ambitions. e.g. 'Cloud-native by 2027, API-first integration strategy, platform engineering model with inner-source practices.'"
            rows={4}
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Guides AI recommendations for technology rationalization, roadmap
            prioritization, and architecture decisions.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() =>
            updateMutation.mutate({
              id: workspaceId,
              industry: industry as any,
              subIndustry: subIndustry.trim() || null,
              region: (region || null) as any,
              regulatoryRegime: regulatoryRegime.trim() || null,
              businessModelHint: businessModelHint.trim() || null,
              missionStatement: missionStatement.trim() || null,
              itVision: itVision.trim() || null,
            })
          }
          disabled={updateMutation.isPending}
          className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white"
        >
          <Save className="h-4 w-4 mr-2" />
          {updateMutation.isPending ? "Saving..." : "Save Organization Profile"}
        </Button>
      </div>
    </div>
  );
}
