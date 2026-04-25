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
  ],
};

export default nextConfig;
