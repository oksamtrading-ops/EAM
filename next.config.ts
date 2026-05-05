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
    // resvg-wasm ships a .wasm file we read via require.resolve at
    // runtime. Marking it external preserves the require() form so
    // the file path resolves at runtime instead of being bundled.
    "@resvg/resvg-wasm",
  ],
  // Trace and copy chart fonts + resvg WASM into the serverless
  // bundle so the rationalization deliverable can render charts on
  // Vercel. Without this, the .otf font files referenced via
  // readFileSync(join(__dirname, "fonts", ...)) don't get packaged
  // because Vercel's NFT can't statically trace dynamic-path reads.
  outputFileTracingIncludes: {
    "/api/export/deliverable-docx": [
      "./src/server/ai/deliverables/charts/fonts/*.otf",
      "./node_modules/@resvg/resvg-wasm/index_bg.wasm",
    ],
  },
};

export default nextConfig;
