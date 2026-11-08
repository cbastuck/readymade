import { readFileSync } from "node:fs";

import { expect, test } from "../support/test";
import { anaOpensIt, cast, deployAndShare, NODE, signIn } from "./beats";
import { bookTomorrowAtSix, raceForOneHour } from "./court";
import { saveTake, shot, startTake } from "./shots";

/**
 * Court Booking for the pitch's gallery: the app in use, not being built.
 * The board the repository ships, deployed and shared; Ana takes tomorrow at
 * six on her phone and the rest of her day closes; then she and Sam reach for
 * one hour at once, one gets it and the other is told.
 *
 * The card opens the browser version; this is what deploying it changes — one
 * database, shared by the club, each booking in a member's name
 * (`plans/TODO-PITCH-SHOWCASE.md`, slide 08).
 */

const PEOPLE = cast("club.example", "Club cloud");

const BOARD = JSON.parse(
  readFileSync("../boards/court-booking-demo-board.json", "utf8"),
) as { boardName: string };

test.use({ hostConfig: { remotes: [NODE] } });

test("the club's courts, booked from two screens at once", async ({
  page,
  browser,
  baseURL,
  seedBoard,
  openBoard,
}) => {
  const take = startTake("court-booking");

  await signIn(page, PEOPLE.sam, PEOPLE.coordinator);
  await seedBoard(BOARD.boardName, BOARD);
  await openBoard(BOARD.boardName);

  // ── 0 · The timetable: three courts, an hour a slot ─────────────────────
  const free = page.getByRole("button", { name: /free — tap to book/ });
  await expect(free.first()).toBeVisible();
  // No hover or focus ring on an hour nobody chose.
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await shot(take, page, {
    id: "0-timetable",
    beat: "0",
    screen: "owner",
    named: { slot: free.first() },
  });

  // Off camera: deployed, and Ana on the club's list.
  await deployAndShare(page, take, PEOPLE);
  await expect(free.first()).toBeVisible();

  // ── 5 · Ana, on her phone ────────────────────────────────────────────────
  const { ana, close } = await anaOpensIt(browser, baseURL, take, PEOPLE, "Court Booking");
  await bookTomorrowAtSix(ana, take);

  // ── 5b · Two people, one hour, the same moment ──────────────────────────
  await raceForOneHour(page, ana, take, PEOPLE);

  saveTake(take);
  await close();
});
