import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { Paragraph, ImageRun, AlignmentType } from "docx";

// resvg-wasm runs in a WASM sandbox without filesystem access, so
// system fonts aren't visible. We bundle Inter Regular + Bold OTF
// (SIL Open Font License 1.1) and pass the bytes via fontBuffers.
// Cache both the WASM init and the loaded fonts so concurrent
// chart renders share a single load.
let initPromise: Promise<void> | null = null;
let fontBuffers: Buffer[] = [];

/** Try a list of candidate paths; return the first that reads
 *  successfully. Used to handle the gap between local Node
 *  (__dirname = source dir), Next.js dev (Webpack/Turbopack
 *  rewrites), and Vercel serverless (NFT-traced bundle). */
function readFirst(candidates: string[]): Buffer {
  const errors: string[] = [];
  for (const p of candidates) {
    try {
      return readFileSync(p);
    } catch (err) {
      errors.push(`${p}: ${(err as Error).message}`);
    }
  }
  throw new Error(
    `Could not load asset; tried:\n${errors.join("\n")}`
  );
}

async function ensureInit(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    // resvg-wasm WASM init (one-shot). The package is marked as
    // serverExternalPackages so require.resolve gives us a real
    // node_modules path at runtime on every host.
    const wasmPath = require.resolve("@resvg/resvg-wasm/index_bg.wasm");
    const wasmBuf = readFileSync(wasmPath);
    await initWasm(wasmBuf);

    // Inter Regular + Bold OTF (SIL OFL 1.1) bundled with the
    // deliverables module. Try paths in priority order to handle
    // Vercel NFT-traced bundles, Next.js bundles, and local Node.
    const fontDirCandidates = [
      // Local Node / direct source execution
      join(__dirname, "fonts"),
      // Vercel/NFT layout: cwd is function root; traced files keep
      // their workspace-relative path
      join(process.cwd(), "src/server/ai/deliverables/charts/fonts"),
      join(
        process.cwd(),
        ".next/server/src/server/ai/deliverables/charts/fonts"
      ),
    ];
    const tryFont = (file: string): Buffer =>
      readFirst(fontDirCandidates.map((d) => join(d, file)));
    fontBuffers = [tryFont("Inter-Regular.otf"), tryFont("Inter-Bold.otf")];
  })();
  return initPromise;
}

/** Render an SVG string to PNG bytes. WASM-based; works on Vercel
 *  serverless without native dependencies. Inter (Regular + Bold)
 *  is bundled and supplied via fontBuffers so text renders
 *  consistently across environments. */
export async function svgToPng(
  svg: string,
  width = 1600
): Promise<Buffer> {
  await ensureInit();
  const r = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: {
      loadSystemFonts: false,
      defaultFontFamily: "Inter",
      fontBuffers,
    },
  });
  return Buffer.from(r.render().asPng());
}

/** Wrap chart PNG bytes into a docx Paragraph with an ImageRun.
 *  Display width in EMU (914400 per inch). 6.5" ≈ 5,943,600 EMU
 *  fits standard US-letter page with default margins. */
export async function svgToDocxImage(opts: {
  svg: string;
  /** Display width in pixels (will scale). Default 600 ≈ 6.25". */
  displayWidthPx?: number;
  /** Display height in pixels. Default 360 ≈ 3.75". */
  displayHeightPx?: number;
  /** Internal render width in pixels (controls PNG resolution). */
  renderWidth?: number;
}): Promise<Paragraph> {
  const renderWidth = opts.renderWidth ?? 1600;
  const png = await svgToPng(opts.svg, renderWidth);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 200 },
    children: [
      new ImageRun({
        data: png,
        transformation: {
          width: opts.displayWidthPx ?? 600,
          height: opts.displayHeightPx ?? 360,
        },
        type: "png",
      } as never),
    ],
  });
}
