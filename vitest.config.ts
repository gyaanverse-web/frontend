import { defineConfig } from "vitest/config";
import { resolve } from "path";

// Lightweight unit-test setup for the frontend. Tests target framework-free
// logic (e.g. role-based nav building), so a plain `node` environment is enough
// — no jsdom/React renderer required.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
