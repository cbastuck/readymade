import { test, expect } from "../support/test";

/**
 * A service inside a sub-service is renamed through its own panel like any
 * other, and the name is kept on the pipeline entry — renamed in place, not by
 * rebuilding what the pipeline runs.
 *
 * Web only: the browser runtime is the one hosting the pipeline in the page.
 */

test.skip(({ profile }) => profile !== "web", "a browser-hosted pipeline");

const board = {
  runtimes: [{ id: "rt", name: "Browser Runtime 1", type: "browser", state: {} }],
  services: {
    rt: [
      {
        uuid: "sub",
        serviceId: "sub-service",
        serviceName: "Browser Sub-Service",
        state: {
          mode: "pipeline",
          pipeline: [{ serviceId: "hookup.to/service/timer", instanceId: "inner-timer" }],
        },
      },
    ],
  },
};

test("rename a service inside a sub-service", async ({ page }) => {
  await page.goto("/playground/e2e-inner-rename");
  await page.waitForFunction(() => !!(window as any).hkp);
  await page.evaluate((b) => (window as any).hkp.loadBoard(b), board);
  const outer = page.locator("#service-frame-sub");
  await outer.getByRole("button", { name: "Show content inline" }).click();
  const inner = page.locator("#service-frame-inner-timer");
  await expect(inner).toBeVisible();

  await inner.getByRole("button", { name: "Service options" }).click();
  await page.getByRole("menuitem", { name: /config/i }).first().click();
  await page.getByLabel("Service name").fill("Heartbeat");
  await page.getByRole("button", { name: "Apply Changes" }).click();

  await expect(inner.getByText("Heartbeat")).toBeVisible();
  const pipeline = await page.evaluate(
    async () => (await (window as any).hkp.getServiceConfig("rt", "sub")).pipeline,
  );
  expect(pipeline[0].serviceName).toBe("Heartbeat");

  // And it survives a reload, through the draft.
  await page.waitForTimeout(3000);
  await page.reload();
  await page.locator("#service-frame-sub").getByRole("button", { name: "Show content inline" }).click();
  await expect(page.locator("#service-frame-inner-timer").getByText("Heartbeat")).toBeVisible();
});
