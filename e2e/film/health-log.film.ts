import { readFileSync } from "node:fs";

import type { Locator, Page } from "@playwright/test";

import { expect, test } from "../support/test";
import { saveTake, shot, startTake } from "./shots";

/**
 * Health Log for the pitch's gallery: the browser version, as a visitor opens
 * it — no server, nobody signed in. A value logged; six months of fictional
 * history generated to look at; Trends with a day's journal beside its value;
 * the whole database exported as a file any SQLite tool opens.
 *
 * What is asserted is what the narration says: the value is kept, the history
 * is charted with its journal, and the export is an SQLite database
 * (`plans/TODO-PITCH-SHOWCASE.md`, slide 08).
 */

const BOARD = JSON.parse(
  readFileSync("../boards/health-log-browser-demo-board.json", "utf8"),
) as { boardName: string };

const GLUCOSE = "118";

/** A tab of the facade, and the confirm some of its buttons ask first. */
const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true });
const confirm = (page: Page) => page.getByRole("button", { name: "Yes, do it" }).click();

/**
 * Moves across a chart until its tooltip names a day's journal: the generated
 * history writes one most days, so a few steps find one.
 */
async function hoverADayWithAJournal(page: Page, chart: Locator): Promise<Locator> {
  const tooltip = page.getByRole("tooltip").filter({ hasText: "Daily journal" });
  const box = (await chart.boundingBox())!;
  for (const at of [0.72, 0.64, 0.8, 0.56, 0.88, 0.48, 0.4]) {
    await page.mouse.move(box.x + box.width * at, box.y + box.height * 0.5);
    if (await tooltip.isVisible()) return tooltip;
  }
  throw new Error("No day with a journal under the pointer");
}

/** The glucose chart: the first drawing on Trends wider than an icon. */
async function firstChart(page: Page): Promise<Locator> {
  const drawings = page.locator("svg").filter({ visible: true });
  await expect.poll(() => drawings.count()).toBeGreaterThan(1);
  for (let i = 0; i < (await drawings.count()); i++) {
    const box = await drawings.nth(i).boundingBox();
    if (box && box.width > 400) return drawings.nth(i);
  }
  throw new Error("No chart on Trends");
}

test("a health log of your own, in the browser", async ({ page, seedBoard, openBoard }) => {
  const take = startTake("health-log");

  await seedBoard(BOARD.boardName, BOARD);
  await openBoard(BOARD.boardName);

  // ── 1 · Log a value: it is kept in this browser ─────────────────────────
  await expect(tab(page, "Log")).toBeVisible();
  const glucose = page.getByPlaceholder("e.g. 118");
  await glucose.fill(GLUCOSE);
  const record = page.getByRole("button", { name: "Record" }).first();
  await page.mouse.move(0, 0);
  await shot(take, page, {
    id: "1-log",
    beat: "1",
    screen: "owner",
    named: { glucose, record },
  });
  await record.click();

  // ── 2 · Six months of fictional history, to look at ─────────────────────
  await tab(page, "Your data").click();
  // The value just logged is a row of the board's own database.
  const table = page.getByRole("table").filter({ visible: true }).first();
  await expect(table).toContainText(GLUCOSE);
  await page.getByRole("button", { name: "Generate fake data" }).click();
  await confirm(page);
  // The table pages its rows; its count is the history's.
  const rows = page.getByText(/^\d+ rows$/).filter({ visible: true }).first();
  await expect
    .poll(async () => parseInt((await rows.textContent()) ?? "0", 10), { timeout: 30_000 })
    .toBeGreaterThan(500);
  await page.mouse.move(0, 0);
  await shot(take, page, {
    id: "2-data",
    beat: "2",
    screen: "owner",
    named: { table, rows, generate: page.getByRole("button", { name: "Generate fake data" }) },
  });

  // ── 3 · Trends: a day's value, with its journal beside it ───────────────
  await tab(page, "Trends").click();
  await expect(page.getByText("Blood glucose · mg/dL").filter({ visible: true })).toBeVisible();
  const chart = await firstChart(page);
  const tooltip = await hoverADayWithAJournal(page, chart);
  await shot(take, page, {
    id: "3-trends",
    beat: "3",
    screen: "owner",
    named: { chart, tooltip },
  });

  // ── 4 · It leaves as a file any SQLite tool opens ───────────────────────
  await page.mouse.move(0, 0);
  await tab(page, "Your data").click();
  const exportIt = page.getByRole("button", { name: "Export as .sqlite" });
  const [download] = await Promise.all([page.waitForEvent("download"), exportIt.click()]);
  expect(download.suggestedFilename()).toBe("health-log.sqlite");
  const file = readFileSync((await download.path())!);
  expect(file.subarray(0, 16).toString("latin1")).toBe("SQLite format 3\u0000");
  await shot(take, page, {
    id: "4-export",
    beat: "4",
    screen: "owner",
    named: { exportIt, table },
  });
  take.figures.exportFile = download.suggestedFilename();
  take.figures.exportBytes = file.length;

  saveTake(take);
});
