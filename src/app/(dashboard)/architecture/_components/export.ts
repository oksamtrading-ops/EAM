import { toPng, toSvg } from "html-to-image";
import { toast } from "sonner";
import type { DiagramApplication, DiagramInterface } from "./ArchitectureCanvas";

type Scenario = "AS_IS" | "TO_BE";

type Args = {
  format: "png" | "svg" | "pptx" | "csv";
  scenario: Scenario;
  workspaceId: string | undefined;
  canvasEl: HTMLDivElement | null;
  apps: DiagramApplication[];
  interfaces: DiagramInterface[];
};

/** The xyflow viewport we want to snapshot (the element holding nodes + edges). */
function getViewportEl(root: HTMLElement): HTMLElement {
  return (
    (root.querySelector(".react-flow__viewport") as HTMLElement) ||
    (root.querySelector(".react-flow") as HTMLElement) ||
    root
  );
}

export async function exportDiagram(args: Args) {
  const { format, scenario, workspaceId, canvasEl, apps, interfaces } = args;

  if (format === "csv") {
    return exportCsv(scenario, apps, interfaces);
  }

  if (!canvasEl) {
    toast.error("Diagram not ready");
    return;
  }

  const viewport = getViewportEl(canvasEl);
  const rfRoot = canvasEl.querySelector(".react-flow") as HTMLElement | null;
  const bg = getComputedStyle(rfRoot ?? canvasEl).backgroundColor || "#ffffff";

  if (format === "png") {
    toast.info("Capturing PNG...");
    const dataUrl = await toPng(viewport, {
      backgroundColor: bg,
      pixelRatio: 2,
      cacheBust: true,
    });
    downloadDataUrl(dataUrl, `Architecture_${scenario}.png`);
    return;
  }

  if (format === "svg") {
    toast.info("Capturing SVG...");
    const dataUrl = await toSvg(viewport, { backgroundColor: bg, cacheBust: true });
    downloadDataUrl(dataUrl, `Architecture_${scenario}.svg`);
    return;
  }

  if (format === "pptx") {
    if (!workspaceId) {
      toast.error("No workspace");
      return;
    }
    toast.info("Generating PowerPoint...");
    // Include a PNG snapshot so the server can embed it on slide 2.
    let pngBase64: string | undefined;
    try {
      const dataUrl = await toPng(viewport, {
        backgroundColor: bg,
        pixelRatio: 2,
        cacheBust: true,
      });
      pngBase64 = dataUrl;
    } catch {
      // fall through — server builds a non-image deck
    }

    const res = await fetch("/api/export/architecture-pptx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, scenario, pngBase64 }),
    });
    if (!res.ok) {
      throw new Error((await res.text()) || "PPTX export failed");
    }
    const blob = await res.blob();
    downloadBlob(blob, `Architecture_${scenario}.pptx`);
    return;
  }
}

function exportCsv(
  scenario: Scenario,
  apps: DiagramApplication[],
  interfaces: DiagramInterface[]
) {
  const appById = new Map(apps.map((a) => [a.id, a]));
  const header = [
    "source",
    "target",
    "name",
    "protocol",
    "direction",
    "criticality",
    "reviewStatus",
    "source_mapping",
    "aiConfidence",
  ];
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const i of interfaces) {
    lines.push(
      [
        appById.get(i.sourceAppId)?.name ?? i.sourceAppId,
        appById.get(i.targetAppId)?.name ?? i.targetAppId,
        i.name,
        i.protocol,
        i.direction,
        i.criticality,
        i.reviewStatus,
        i.source,
        i.aiConfidence ?? "",
      ]
        .map(escape)
        .join(",")
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `Architecture_${scenario}.csv`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
