"use client";

import { useState } from "react";
import { Building2, Package, History, Boxes, ShieldCheck, BookOpen, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspace } from "@/hooks/useWorkspace";
import { TechArchToolbar } from "./TechArchToolbar";
import { TechArchKpiBar } from "./TechArchKpiBar";
import { VendorsTab } from "./VendorsTab";
import { ProductsTab } from "./ProductsTab";
import { VersionsTab } from "./VersionsTab";
import { ComponentsTab } from "./ComponentsTab";
import { StandardsTab } from "./StandardsTab";
import { ReferenceArchitecturesTab } from "./ReferenceArchitecturesTab";
import { FindingsTab } from "./FindingsTab";

export function TechArchClient() {
  const [tab, setTab] = useState("vendors");
  const { workspaceId } = useWorkspace();
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);

  async function download(
    url: string,
    filename: string,
    setFlag: (b: boolean) => void,
    label: string
  ) {
    setFlag(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!res.ok) {
        toast.error("Export failed");
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(objectUrl);
      toast.success(`${label} downloaded`);
    } catch {
      toast.error("Export failed");
    } finally {
      setFlag(false);
    }
  }

  return (
    <div className="h-full flex flex-col min-w-0 overflow-hidden">
      <TechArchToolbar
        onExportXlsx={() =>
          download(
            "/api/export/tech-architecture-xlsx",
            "Technology_Architecture_Export.xlsx",
            setExportingXlsx,
            "XLSX export"
          )
        }
        onExportPptx={() =>
          download(
            "/api/export/tech-architecture-pptx",
            "Technology_Architecture.pptx",
            setExportingPptx,
            "Boardroom deck"
          )
        }
        exportingXlsx={exportingXlsx}
        exportingPptx={exportingPptx}
      />

      <div className="flex-1 overflow-auto">
        <div className="px-4 sm:px-5 py-4 space-y-4">
          <TechArchKpiBar />

          <Tabs value={tab} onValueChange={(v) => setTab(v as string)}>
            <TabsList className="w-full justify-start flex-wrap h-auto">
              <TabsTrigger value="vendors">
                <Building2 className="h-3.5 w-3.5 mr-1.5" />
                Vendors
              </TabsTrigger>
              <TabsTrigger value="products">
                <Package className="h-3.5 w-3.5 mr-1.5" />
                Products
              </TabsTrigger>
              <TabsTrigger value="versions">
                <History className="h-3.5 w-3.5 mr-1.5" />
                Versions &amp; Lifecycle
              </TabsTrigger>
              <TabsTrigger value="components">
                <Boxes className="h-3.5 w-3.5 mr-1.5" />
                Components
              </TabsTrigger>
              <TabsTrigger value="standards">
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                Standards
              </TabsTrigger>
              <TabsTrigger value="reference">
                <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                Reference Architectures
              </TabsTrigger>
              <TabsTrigger value="findings">
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                Findings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="vendors" className="mt-4"><VendorsTab /></TabsContent>
            <TabsContent value="products" className="mt-4"><ProductsTab /></TabsContent>
            <TabsContent value="versions" className="mt-4"><VersionsTab /></TabsContent>
            <TabsContent value="components" className="mt-4"><ComponentsTab /></TabsContent>
            <TabsContent value="standards" className="mt-4"><StandardsTab /></TabsContent>
            <TabsContent value="reference" className="mt-4"><ReferenceArchitecturesTab /></TabsContent>
            <TabsContent value="findings" className="mt-4"><FindingsTab /></TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
