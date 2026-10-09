import { test, expect } from "../support/test";
import { redact, safeUrl } from "../support/diagnostics";
import { cleanupCloud } from "../support/cloudCleanup";
import type { APIRequestContext, TestInfo } from "@playwright/test";

test("unmocked dependencies are blocked, while explicit mocks take precedence", async ({ page }) => {
  const denied = await page.goto("https://api.example.test/unmocked");
  expect(denied?.status()).toBe(503);
  await expect(page.locator("body")).toContainText("External dependency is not mocked");
  await page.route("https://api.example.test/mock", (route) => route.fulfill({ status: 200, body: "local fixture response" }));
  const mocked = await page.goto("https://api.example.test/mock");
  expect(mocked?.status()).toBe(200);
  await expect(page.locator("body")).toHaveText("local fixture response");
});

test("uncaught browser errors cannot leave a test green", async ({ page }) => {
  test.fail(true, "The automatic diagnostics fixture must reject the injected error; an unexpected pass means the guard broke");
  await page.goto("/");
  const error = page.waitForEvent("pageerror");
  await page.evaluate(() => setTimeout(() => { throw new Error("E2E diagnostic probe"); }, 0));
  expect((await error).message).toBe("E2E diagnostic probe");
  // No assertion failure here: the automatic fixture must fail at teardown.
});

test("diagnostic URLs and token strings omit credentials", () => {
  expect(safeUrl("https://user:password@api.example.test/path?access_token=secret#secret")).toBe("https://api.example.test/path");
  expect(redact("Bearer synthetic-token https://api.example.test/?ticket=private&access_token=private"))
    .toBe("Bearer [redacted] https://api.example.test/?ticket=[redacted]&access_token=[redacted]");
});

test("native presets round-trip as source text across reloads", async ({ page, profile }) => {
  test.skip(profile === "web", "the web profile has no native preset adapter");
  await page.goto("/");
  const source = '{"preset":"v1","id":"fixture-preset","name":"Synthetic preset","serviceId":"hookup.to/service/timer","state":{"oneShotDelay":3}}';
  await page.evaluate(async (body) => {
    const saved = await fetch("hkp://presets/fixture.json", { method: "POST", body });
    if (!saved.ok) throw new Error(`Preset save failed: ${saved.status}`);
  }, source);
  await page.reload();
  expect(await page.evaluate(async () => (await fetch("hkp://presets")).json()))
    .toContainEqual({ file: "fixture.json", source });
  expect(await page.evaluate(async () => (await fetch("hkp://presets/fixture.json", { method: "DELETE" })).ok)).toBe(true);
  expect(await page.evaluate(async () => (await fetch("hkp://presets")).json())).toEqual([]);
});

test("cleanup continues after an error and preserves an earlier failure", async ({}, testInfo) => {
  const calls: string[] = [];
  const response = (status: number, body: unknown) => ({
    ok: () => status < 400, status: () => status, json: async () => body,
  });
  const request = {
    get: async (url: string) => response(200, url.endsWith("boards")
      ? { boards: [{ boardName: "first" }, { boardName: "second" }] } : { runtimes: [] }),
    delete: async (url: string) => { calls.push(url); return response(url.endsWith("first") ? 500 : 204, {}); },
  } as unknown as APIRequestContext;
  await expect(cleanupCloud(request, testInfo, "http://coordinator.test", "synthetic-user", ["http://runtime.test"]))
    .rejects.toThrow("Cloud cleanup failed");
  expect(calls).toEqual([
    "http://coordinator.test/users/synthetic-user/boards/first",
    "http://coordinator.test/users/synthetic-user/boards/second",
    "http://runtime.test/runtimes",
  ]);
  // Simulate entry with an already-failed test. The same cleanup errors must
  // be attached, but must not throw and replace the original assertion.
  await cleanupCloud(request, { ...testInfo, status: "failed", attach: testInfo.attach.bind(testInfo) } as TestInfo,
    "http://coordinator.test", "synthetic-user", ["http://runtime.test"]);
});
