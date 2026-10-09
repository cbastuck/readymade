import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import SummaryReporter from "../summaryReporter.ts";

test("summary separates expected failures, unexpected passes, flakes and retries", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "readymade-reporter-"));
  const previous = process.env.GITHUB_STEP_SUMMARY;
  process.env.GITHUB_STEP_SUMMARY = path.join(directory, "summary.md");
  const entry = (outcome, expectedStatus, statuses) => ({
    outcome: () => outcome, expectedStatus, results: statuses.map((status) => ({ status })),
  });
  try {
    const reporter = new SummaryReporter();
    reporter.onBegin({ projects: [{ outputDir: directory }] }, { allTests: () => [
      entry("expected", "passed", ["passed"]),
      entry("unexpected", "passed", ["failed"]),
      entry("expected", "failed", ["failed"]),
      entry("unexpected", "failed", ["passed"]),
      entry("flaky", "passed", ["failed", "passed"]),
      entry("skipped", "passed", ["skipped"]),
      entry("unexpected", "passed", ["timedOut"]),
    ] });
    reporter.onEnd({ status: "failed", duration: 2500 });
    assert.deepEqual(JSON.parse(readFileSync(path.join(directory, "summary.json"), "utf8")), {
      status: "failed", durationSeconds: 2.5, total: 7, executed: 6, passed: 1,
      expectedFailures: 1, failed: 3, flaky: 1, skipped: 1, retriedTests: 1, retryAttempts: 1,
    });
    assert.match(readFileSync(process.env.GITHUB_STEP_SUMMARY, "utf8"), /\| 7 \| 6 \| 1 \| 1 \| 3 \| 1 \| 1 \| 1 \| 1 \|/);
  } finally {
    if (previous === undefined) delete process.env.GITHUB_STEP_SUMMARY;
    else process.env.GITHUB_STEP_SUMMARY = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
