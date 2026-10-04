import { readFileSync } from "node:fs";

import { test, expect } from "../support/test";

/**
 * The browser's `sql` service in the page: SQLite loads as WebAssembly, runs
 * the board's statements, and keeps its tables in IndexedDB so they outlive
 * the page.
 *
 * Unit tests run the engine's Node build; only a browser shows that the
 * WebAssembly is served and found by the app's own bundling, and that a
 * database comes back after the page is gone.
 *
 * Not on the mobile profile: its shell opens a board as its list of services
 * rather than its facade.
 */
test.skip(({ profile }) => profile === "mobile", "the facade is not the mobile shell's first view");

const NAME = "e2e-court-booking-browser";
const board = JSON.parse(
  readFileSync("../boards/court-booking-browser-demo-board.json", "utf8"),
);

test("a booking made in the browser is still there when the board is reopened", async ({
  page,
  seedBoard,
  openBoard,
}) => {
  const crashes: string[] = [];
  page.on("pageerror", (error) => crashes.push(String(error)));

  await seedBoard(NAME, board);
  await openBoard(NAME);

  // Court 1 is the first cell of each hour's row.
  const nineOnCourtOne = page.getByRole("button", { name: /^09:00/ }).first();
  await expect(nineOnCourtOne).toHaveAttribute("aria-label", /free/, {
    timeout: 15_000,
  });

  await nineOnCourtOne.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Yes, do it" })
    .click();
  await expect(nineOnCourtOne).toHaveAttribute("aria-label", /booked by you/);
  // One hour a day: the same hour on another court is no longer offered.
  await expect(
    page.getByRole("button", { name: /^09:00/ }).nth(1),
  ).toHaveAttribute("aria-label", /not available/);

  // Straight away: the snapshot is written a moment after a change, so
  // leaving at once is what depends on the write the page starts on its way
  // out.
  await openBoard(NAME);
  await expect(
    page.getByRole("button", { name: /^09:00/ }).first(),
  ).toHaveAttribute("aria-label", /booked by you/, { timeout: 15_000 });

  expect(crashes).toEqual([]);
});
