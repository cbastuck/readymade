import type { ReporterDescription } from "@playwright/test";

export const reporters: ReporterDescription[] = [
  process.env.CI ? ["github"] : ["list"],
  ["html", { open: "never" }],
  ["./support/summaryReporter.ts"],
];
