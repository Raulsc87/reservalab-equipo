import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/**/*.unit.test.ts",
      "tests/**/*.integration.test.ts"
    ],
    clearMocks: true,
    testTimeout: 60000,
    hookTimeout: 60000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "html"],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70
      }
    }
  }
});