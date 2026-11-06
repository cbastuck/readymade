import { readFileSync } from "node:fs";

import type { Page } from "@playwright/test";

import { expect, test } from "../support/test";
import { useHttpTape } from "./httpTape";
import { saveTake, shot, startTake } from "./shots";

/**
 * HN Reader for the pitch's gallery: a still of the app in use. The front
 * page on one side, the discussion of its busiest story on the other, one
 * branch folded — what the card promises: whole threads, folded where you
 * left them.
 *
 * Hacker News itself is a recording (`httpTape.ts`): a take never reaches the
 * internet, so the front page and the thread were fetched once, for real, and
 * are played back. Record again with
 * `FILM_HTTP=record FILM_STORY=hacker-news npm run film -- hacker-news`.
 */

const SLUG = "hacker-news";
const BOARD = JSON.parse(
  readFileSync("../boards/hacker-news-board.json", "utf8"),
) as { boardName: string };

const ORIGINS = ["https://hn.algolia.com", "https://hacker-news.firebaseio.com"];

/** The "N comments" button of each story on screen, with its count. */
async function commentButtons(page: Page) {
  const buttons = page.getByRole("button", { name: /^\d+ comments?$/ });
  const found = [];
  for (let i = 0; i < (await buttons.count()); i++) {
    const label = (await buttons.nth(i).textContent()) ?? "";
    found.push({ button: buttons.nth(i), count: parseInt(label, 10) });
  }
  return found;
}

test("Hacker News to read, not to scroll", async ({ page, seedBoard, openBoard }) => {
  const take = startTake(SLUG);
  const tape = await useHttpTape(page, SLUG, ORIGINS);
  test.skip(tape.mode === "off", "Record HN first: FILM_HTTP=record FILM_STORY=hacker-news npm run film -- hacker-news");

  await seedBoard(BOARD.boardName, BOARD);
  await openBoard(BOARD.boardName);

  // ── The front page ──────────────────────────────────────────────────────
  await expect.poll(async () => (await commentButtons(page)).length, { timeout: 30_000 }).toBeGreaterThan(5);

  // ── The busiest of the first stories, its thread beside the list ────────
  const first = (await commentButtons(page)).slice(0, 8);
  const busiest = first.reduce((a, b) => (b.count > a.count ? b : a));
  await busiest.button.click();
  const fold = page.getByRole("button", { name: "[–]" });
  await expect.poll(() => fold.count(), { timeout: 30_000 }).toBeGreaterThan(3);

  // One branch folded: the first comment someone answered.
  const folded = page.getByRole("button", { name: /^\[\+\d+\]$/ });
  // A comment nobody answered folds to "[+]", and is opened again.
  for (let i = 0; i < 10; i++) {
    await fold.nth(i).click();
    if (await folded.first().isVisible()) break;
    await page.getByRole("button", { name: "[+]", exact: true }).first().click();
  }
  await expect(folded.first()).toBeVisible();
  await page.mouse.move(0, 0);
  await shot(take, page, {
    id: "1-reader",
    beat: "1",
    screen: "owner",
    named: { story: busiest.button, folded: folded.first() },
  });
  take.figures.recordedComments = busiest.count;

  saveTake(take);
  tape.finish();
});
