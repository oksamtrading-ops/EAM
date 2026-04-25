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
};

export default nextConfig;
