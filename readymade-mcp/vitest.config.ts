import { defineConfig } from "vitest/config";

// Only this package's tests: bundle/ holds copies of runtime sources, with
// their own tests, that are not ours to run.
export default defineConfig({ test: { include: ["tests/**/*.test.ts"] } });
