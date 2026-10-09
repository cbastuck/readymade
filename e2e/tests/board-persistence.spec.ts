import { test, expect, service } from "../support/test";
import type { Locator } from "@playwright/test";
import timerMonitor from "../fixtures/boards/timer-monitor.json" with { type: "json" };

const name = "e2e-saved-edit";
const board = { ...timerMonitor, boardName: name };

test.beforeEach(async ({ seedBoard }) => {
  await seedBoard(name, board);
});

test("a saved edit survives reload and reopening from the library", async ({
  page, profile, openBoard, hostState,
}) => {
  // Save, reload and two library reopens span several full document loads.
  // Hosted WebKit takes 6–12s per load; keep a bounded journey budget while
  // individual assertions retain their normal timeouts.
  test.setTimeout(60_000);
  await openBoard(name);
  const frame = service(page, "e2e-timer");
  const press = async (target: Locator) =>
    profile === "mobile" ? target.tap() : target.click();
  await press(frame.getByRole("radio", { name: "oneshot", exact: true }));
  const delayUnit = frame.getByRole("combobox").first();
  await expect(delayUnit).toHaveText("ms");
  await press(delayUnit);
  await press(page.getByRole("option", { name: "s", exact: true }));
  await expect(delayUnit).toHaveText("s");

  if (profile === "mobile") {
    await press(page.getByRole("button", { name: "Switch to card view" }));
    await press(page.getByRole("button", { name: "Board menu" }));
    await press(page.getByRole("button", { name: /Save board.*Keep this board/ }));
    await press(page.getByRole("button", { name: "Save to this device", exact: true }));
  } else {
    await page.keyboard.press("ControlOrMeta+s");
  }

  const savedUnit = async () => {
    const saved = profile === "desktop"
      ? (await hostState()).boards as Record<string, typeof board>
      : await page.evaluate((n) => {
          const item = JSON.parse(localStorage.getItem(`hkp-playground-${n}`) ?? "null");
          return { [n]: item ? JSON.parse(item.source) : null };
        }, name);
    return saved[name]?.services.ui[0].state.oneShotDelayUnit;
  };
  await expect.poll(savedUnit).toBe("s");
  await page.reload();
  // Native shells reload to their start page; reopen there using their normal
  // library path. The web shell restores the open board directly.
  if (profile !== "web") await openBoard(name);
  await expect(delayUnit).toHaveText("s");
  await expect.poll(savedUnit).toBe("s");

  await openBoard(name);
  await expect(delayUnit).toHaveText("s");
});

test("native host writes survive document replacement", async ({ page, profile, openBoard, hostState }) => {
  test.skip(profile === "web", "the web profile has no native host");
  await openBoard(name);
  await page.evaluate(async () => {
    const exposed = (window as any).saucer.exposed;
    await exposed.writeFile("/test/saved.txt", "edited file");
    await exposed.setSecret("test-alias", "synthetic-test-value");
    await exposed.setSecretAudience("test-alias", ["api.example.test"]);
    await exposed.grantSecrets("test-board/runtime", ["test-alias"]);
    const response = await fetch("hkp://settings", {
      method: "POST",
      body: JSON.stringify({ allowExternalRuntimeAccess: true, allowedUsers: ["test@example.test"] }),
    });
    if (!response.ok) throw new Error(`Settings failed: ${response.status}`);
  });
  await page.reload();
  expect(await hostState()).toMatchObject({
    files: { "/test/saved.txt": "edited file" },
    secrets: { "test-alias": "synthetic-test-value" },
    audiences: { "test-alias": ["api.example.test"] },
    grants: { "test-board/runtime": ["test-alias"] },
    settings: { allowExternalRuntimeAccess: true, allowedUsers: ["test@example.test"] },
  });
});

test("a deleted seed is not restored by another navigation", async ({ page, profile, openBoard }) => {
  await openBoard(name);
  await page.evaluate(async ({ name, native }) => {
    localStorage.removeItem(`hkp-playground-${name}`);
    if (native) {
      const response = await fetch(`hkp://boards/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
    }
  }, { name, native: profile !== "web" });
  await page.goto("/");
  expect(await page.evaluate((n) => localStorage.getItem(`hkp-playground-${n}`), name)).toBeNull();
  if (profile !== "web") {
    expect(await page.evaluate(async (n) => (await fetch(`hkp://boards/${n}`)).status, name)).toBe(404);
  }
});
