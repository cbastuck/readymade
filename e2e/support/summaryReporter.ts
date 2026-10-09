import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { FullConfig, FullResult, Reporter, Suite } from "@playwright/test/reporter";

export default class SummaryReporter implements Reporter {
  private suite?: Suite;
  private directory = "test-results";
  onBegin(config: FullConfig, suite: Suite) {
    this.suite = suite;
    this.directory = config.projects[0]?.outputDir ?? this.directory;
  }
  onEnd(result: FullResult) {
    const tests = this.suite?.allTests() ?? [];
    const counts = {
      total: tests.length, executed: 0, passed: 0, expectedFailures: 0,
      failed: 0, flaky: 0, skipped: 0, retriedTests: 0, retryAttempts: 0,
    };
    for (const test of tests) {
      const outcome = test.outcome();
      if (outcome === "skipped") { counts.skipped++; continue; }
      counts.executed++;
      if (test.results.length > 1) counts.retriedTests++;
      counts.retryAttempts += Math.max(0, test.results.length - 1);
      if (outcome === "unexpected") counts.failed++;
      else if (outcome === "flaky") counts.flaky++;
      else if (test.expectedStatus === "failed") counts.expectedFailures++;
      else counts.passed++;
    }
    const summary = { status: result.status, durationSeconds: result.duration / 1000, ...counts };
    mkdirSync(this.directory, { recursive: true });
    writeFileSync(path.join(this.directory, "summary.json"), JSON.stringify(summary, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        `### E2E results (${result.status})\n\n` +
        "| Total | Executed | Passed | Expected failures | Failed | Flaky | Skipped | Retried tests | Retry attempts |\n" +
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n" +
        `| ${counts.total} | ${counts.executed} | ${counts.passed} | ${counts.expectedFailures} | ${counts.failed} | ${counts.flaky} | ${counts.skipped} | ${counts.retriedTests} | ${counts.retryAttempts} |\n\n` +
        `Duration: ${summary.durationSeconds.toFixed(1)} seconds.\n`);
    }
  }
}
