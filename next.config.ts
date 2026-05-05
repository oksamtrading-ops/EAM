import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma 7 + adapter-pg ships native binaries that Turbopack/webpack
  // can't bundle. Mark them external so they're require()'d from
  // node_modules at runtime instead. Without this, every tRPC route
  // fails on Vercel with "Cannot load @napi-…".
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "@prisma/engines",
    // pdf-parse v2 wraps pdfjs-dist which uses @napi-rs/canvas.
    // Native binaries can't be bundled — must be require()'d at
    // runtime. Combined with the lazy import in pdfExtract.ts so
    // these only load when a PDF is actually uploaded.
    "pdf-parse",
    "pdfjs-dist",
    "@napi-rs/canvas",
  ],
  // Trace and copy chart fonts into the serverless bundle so the
  // rationalization deliverable can render charts on Vercel.
  // Without this, the .otf font files referenced via
  // readFileSync(join(__dirname, "fonts", ...)) don't get packaged
  // because Vercel's NFT can't statically trace dynamic-path reads.
  // The @resvg/resvg-wasm .wasm asset is handled separately via a
  // /*turbopackIgnore: true*/ require.resolve in _renderer.ts;
  // NFT picks the .wasm up automatically because the package.json
  // `files` field in resvg-wasm includes it.
  outputFileTracingIncludes: {
    "/api/export/deliverable-docx": [
      "./src/server/ai/deliverables/charts/fonts/*.otf",
    ],
  },
};

export default nextConfig;
