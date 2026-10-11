import { readFileSync } from "node:fs";

import { test, expect } from "../support/test";
import { courtBookingForSqlTests } from "../support/courtBooking";

/**
 * The SQL Explorer over a database another board made: the browser's `sql`
 * listing what it keeps, a table's rows in the facade's data table, the
 * database leaving as an SQL dump through the Download service, and a value
 * changed and a row deleted from the table itself.
 *
 * Web only: the Readymade shells' webviews handle a download through their
 * host, which this suite fakes, rather than through the browser.
 */
test.skip(({ profile }) => profile !== "web", "browser downloads are the web host's");

const board = (file: string) =>
  JSON.parse(readFileSync(`../boards/${file}`, "utf8"));

test("shows a database another board made, exports it, and changes it", async ({
  page,
  seedBoard,
  openBoard,
}) => {
  // Three document loads plus export/edit/delete on hosted runners.
  test.setTimeout(60_000);
  const crashes: string[] = [];
  page.on("pageerror", (error) => crashes.push(String(error)));

  await seedBoard("e2e-court", courtBookingForSqlTests());
  await seedBoard("e2e-explorer", board("sql-explorer-board.json"));

  await openBoard("e2e-court");
  const nine = page.getByRole("button", { name: /^09:00/ }).first();
  await expect(nine).toHaveAttribute("aria-label", /free/, { timeout: 15_000 });
  await nine.click();
  await page.getByRole("dialog").getByRole("button", { name: "Yes, do it" }).click();
  await expect(nine).toHaveAttribute("aria-label", /booked by you/);

  await openBoard("e2e-explorer");
  await page.getByRole("button", { name: "tennis" }).click({ timeout: 15_000 });
  await page.getByRole("button", { name: "court_booking" }).click();
  // The rows panel shows the table's own columns, not the placeholder's.
  await expect(page.getByRole("columnheader", { name: "member" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "hint" })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "you@club.example" })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export .sql" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("tennis.sql");
  const dump = readFileSync(await file.path(), "utf8");
  expect(dump).toMatch(/^PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n/);
  expect(dump).toContain("CREATE TABLE IF NOT EXISTS court_booking");
  expect(dump).toMatch(/INSERT INTO "court_booking"\(.*\) VALUES\(1,1,'\d{4}-\d{2}-\d{2}',9,'you@club.example',/);
  expect(dump).toContain("CREATE UNIQUE INDEX IF NOT EXISTS court_booking_one_per_slot");
  expect(dump.trimEnd().endsWith("COMMIT;")).toBe(true);

  // A value, changed in place: the cell opens a field holding it.
  await page.getByRole("button", { name: "you@club.example" }).click();
  const field = page.getByRole("dialog").getByRole("textbox");
  await expect(field).toHaveValue("you@club.example");
  await field.fill("anna@club.example");
  await field.press("Enter");
  await expect(page.getByRole("button", { name: "anna@club.example" })).toBeVisible();

  // A row, deleted: ticked, then confirmed.
  await page.getByRole("row").filter({ hasText: "anna@club.example" }).getByRole("checkbox").check();
  await page.getByRole("button", { name: "Delete picked rows" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Yes, do it" }).click();
  await expect(page.getByRole("button", { name: "anna@club.example" })).toHaveCount(0);

  // And the booking board sees the table as the explorer left it.
  await openBoard("e2e-court");
  await expect(nine).toHaveAttribute("aria-label", /free/, { timeout: 15_000 });

  expect(crashes).toEqual([]);
});
