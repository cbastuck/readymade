import { test, expect } from "../../support/test";
import { NODE_URL } from "../../playwright.cloud.config";

// Selected only by HKP_E2E_FAILURE_PROBE=1 (or the local flaky mode).
// A manual workflow run should fail
// and upload the report, trace, screenshot, browser diagnostics and server log.
test("cloud failure artifacts include browser errors and runtime logs", async ({ page, request }, testInfo) => {
  expect((await request.get(`${NODE_URL}/runtimes`)).ok()).toBe(true);
  await page.goto("/");
  // The local flaky mode proves CI stays red after a successful retry.
  if (process.env.HKP_E2E_FAILURE_PROBE === "flaky" && testInfo.retry > 0) return;
  const error = page.waitForEvent("pageerror");
  await page.evaluate(() => setTimeout(() => { throw new Error("Synthetic CI artifact probe"); }, 0));
  await error;
});
