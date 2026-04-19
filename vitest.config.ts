import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts", "src/**/evals/**/*.test.ts"],
    exclude: ["node_modules", ".next", "src/generated/**"],
    testTimeout: 120_000,
    hookTimeout: 60_000,
    setupFiles: ["src/server/ai/evals/_setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      // `server-only` throws when imported outside a React Server
      // Component context; Node tests run happily server-side so stub it.
      "server-only": path.resolve(root, "src/server/ai/evals/_server-only-stub.ts"),
    },
  },
});
