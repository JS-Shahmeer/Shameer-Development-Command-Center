import { defineConfig } from "vitest/config";

// Runs services against a real Postgres database. Set DATABASE_URL to a throwaway
// database (CI uses a service container); tests wipe it between cases.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 30_000,
  },
});
