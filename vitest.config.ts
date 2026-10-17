import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/helpers/setup.ts"],
    globals: true,
    exclude: ["**/node_modules/**", "**/.claude/**", "**/.kilo/**", "e2e/**"],
  },
});
