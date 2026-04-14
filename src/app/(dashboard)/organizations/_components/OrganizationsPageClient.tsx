"use client";

import { useState } from "react";
import {
  Building2,
  Workflow,
  Target,
  Users,
  Sparkles,
  Globe,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OverviewTab } from "./tabs/OverviewTab";
import { BusinessUnitsTab } from "./tabs/BusinessUnitsTab";
import { ValueStreamsTab } from "./tabs/ValueStreamsTab";
import { ObjectivesTab } from "./tabs/ObjectivesTab";
import { PeopleTab } from "./tabs/PeopleTab";

const TABS = [
  { value: "overview", label: "Overview", icon: Globe },
  { value: "units", label: "Business Units", icon: Building2 },
  { value: "streams", label: "Value Streams", icon: Workflow },
  { value: "objectives", label: "Strategic Objectives", icon: Target },
  { value: "people", label: "People", icon: Users },
] as const;

export function OrganizationsPageClient() {
  return (
    <div className="max-w-4xl p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Organization
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Organization context that shapes AI outputs across the platform.
        </p>
      </div>

      {/* AI context banner */}
      <div className="rounded-xl border border-[var(--ai)]/20 bg-gradient-to-r from-[var(--ai)]/5 to-transparent p-4 flex gap-3">
        <Sparkles className="h-4 w-4 text-[var(--ai)] shrink-0 mt-0.5" />
        <div className="text-xs text-foreground leading-relaxed">
          <p className="font-semibold mb-1">Used by AI Assistant features</p>
          <p className="text-muted-foreground">
            App-to-Capability Auto-Mapping, Rationalization, Tech
            Recommendations, Risk Narratives, and the Executive Brief all use
            this context to tailor suggestions to your specific organization.
          </p>
        </div>
      </div>

      {/* Tabbed content */}
      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-full justify-start border-b pb-0">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="pt-6">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="units" className="pt-6">
          <BusinessUnitsTab />
        </TabsContent>
        <TabsContent value="streams" className="pt-6">
          <ValueStreamsTab />
        </TabsContent>
        <TabsContent value="objectives" className="pt-6">
          <ObjectivesTab />
        </TabsContent>
        <TabsContent value="people" className="pt-6">
          <PeopleTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
