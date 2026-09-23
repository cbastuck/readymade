import type { Page } from "@playwright/test";

import { test, expect } from "../support/test";

/**
 * An unsaved board on the web is kept as a draft in IndexedDB
 * (hkp-frontend/src/core/boardDrafts) and restored at its address on reload.
 *
 * Web only: Readymade keeps its own history through the platform host, and the
 * web shell is the one that routes by board name.
 */
test.skip(({ profile }) => profile !== "web", "drafts are the web host's");

const NAME = "e2e-draft-sketch";

const board = {
  runtimes: [{ id: "rt", name: "Browser Runtime 1", type: "browser", state: {} }],
  services: {
    rt: [
      {
        uuid: "sub",
        serviceId: "sub-service",
        serviceName: "Browser Sub-Service",
        state: { mode: "pipeline", pipeline: [] },
      },
    ],
  },
};

const pipelineOf = (page: Page) =>
  page.evaluate(
    // Empty rather than throwing while the board is still being restored, so
    // a poll waits for it instead of failing on the first read.
    async () =>
      (await (window as any).hkp?.getServiceConfig("rt", "sub"))?.pipeline ??
      [],
  );

const draftNames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open("hkp-board-drafts", 1);
        open.onupgradeneeded = () =>
          open.result.createObjectStore("drafts", { keyPath: "boardName" });
        open.onsuccess = () => {
          const req = open.result
            .transaction("drafts", "readonly")
            .objectStore("drafts")
            .getAllKeys();
          req.onsuccess = () => {
            open.result.close();
            resolve(req.result as string[]);
          };
          req.onerror = () => reject(req.error);
        };
      }),
  );

test("an unsaved sketch survives a reload, and saving drops its draft", async ({
  page,
}) => {
  // Loaded without saving, the way a sketch starts: nothing in the library.
  await page.goto(`/playground/${NAME}`);
  await page.waitForFunction(() => !!(window as any).hkp);
  await page.evaluate((b) => (window as any).hkp.loadBoard(b), board);
  const frame = page.locator("#service-frame-sub");
  await expect(frame).toBeVisible();

  // Opening a board is not an edit: no draft yet.
  await page.waitForTimeout(1500);
  expect(await draftNames(page)).toEqual([]);

  // The person's edit, through the panel: add a Timer inside the sub-service.
  await frame.getByRole("button", { name: "Show content inline" }).click();
  await page.locator("#service-selector-sub-pipeline-sub").click();
  await page.keyboard.type("Timer");
  await page.getByRole("option", { name: /^Timer/ }).first().click();
  await expect.poll(() => pipelineOf(page)).toHaveLength(1);

  await page.waitForTimeout(3000);
  expect(await draftNames(page)).toEqual([NAME]);

  await page.reload();
  await page.waitForFunction(() => !!(window as any).hkp);
  await expect(page.getByText(`Restored the unsaved board '${NAME}'.`)).toBeVisible();
  await expect.poll(() => pipelineOf(page)).toHaveLength(1);
  const [entry] = await pipelineOf(page);
  expect(entry.serviceId).toBe("hookup.to/service/timer");

  // Saving makes it a saved board and drops the draft.
  await page.keyboard.press("ControlOrMeta+s");
  await expect
    .poll(() =>
      page.evaluate((n) => !!localStorage.getItem(`hkp-playground-${n}`), NAME),
    )
    .toBe(true);
  await expect.poll(() => draftNames(page)).toEqual([]);

  // And reloading a saved, untouched board writes no draft.
  await page.reload();
  await expect.poll(() => pipelineOf(page)).toHaveLength(1);
  await page.waitForTimeout(3000);
  expect(await draftNames(page)).toEqual([]);
});
