import { readFileSync } from "node:fs";

import type { Page } from "@playwright/test";

import { expect, test } from "../support/test";
import { anaOpensIt, askTheAssistant, cast, deployAndShare, NODE, signIn, watchTheRun } from "./beats";
import { saveTake, shot, startTake } from "./shots";

/**
 * The golden path, filmed: Sam deploys the club's booking board and adds Ana
 * by her address; Ana books tomorrow at six on her phone; Sam watches the
 * booking arrive. Then both reach for the same hour at once, and the one who
 * loses is told.
 *
 * The story is `plans/TODO-GOLDEN-PATH-VIDEO.md`; each shot names its beat.
 * What is asserted is what the narration says — if a beat is not true, the
 * take fails rather than filming it.
 */

const PEOPLE = cast("club.example", "Club cloud");
const { sam: SAM, ana: ANA } = PEOPLE;

const BOARD = JSON.parse(
  readFileSync("../boards/court-booking-demo-board.json", "utf8"),
) as { boardName: string };

/** What Sam asks for in beat 1 — the narration's sentence, as typed. */
const PROMPT =
  "A booking page for our tennis club: three courts, hourly slots from 7 to 21, " +
  "one hour per member a day, booked in the name of whoever is signed in. " +
  "Run it on the node server so the club can share it.";

test.use({ hostConfig: { remotes: [NODE] } });

test("from a deployed board to a member's phone", async ({
  page,
  browser,
  baseURL,
  seedBoard,
  openBoard,
}) => {
  const take = startTake("golden-path");

  await signIn(page, SAM, PEOPLE.coordinator);
  const asked = await askTheAssistant(page, take, {
    prompt: PROMPT,
    boardName: BOARD.boardName,
    seedBoard,
    openBoard,
  });
  if (!asked) {
    // No recorded run yet: beats 1–3 are skipped and the take starts from
    // the board the repository ships, which is what the assistant is asked
    // to arrive at.
    await seedBoard(BOARD.boardName, BOARD);
    await openBoard(BOARD.boardName);
  }

  // ── 4 · Deploy, and add a member by her address ─────────────────────────
  await expect(page.getByRole("button", { name: /free — tap to book/ }).first()).toBeVisible();
  await deployAndShare(page, take, PEOPLE);

  // ── 5 · Ana, on her phone ────────────────────────────────────────────────
  const { ana, close } = await anaOpensIt(browser, baseURL, take, PEOPLE, "Court Booking");

  // Tomorrow, court 2, six o'clock.
  const tomorrow = ana.getByRole("button", { name: "+1", exact: true });
  await expect(tomorrow).toBeVisible();
  await tomorrow.tap();
  const six = ana.getByRole("button", { name: "18:00, free — tap to book" }).nth(1);
  await expect(six).toBeVisible();
  await six.scrollIntoViewIfNeeded();
  await shot(take, ana, {
    id: "5-calendar",
    beat: "5",
    screen: "member",
    named: { tomorrow, six },
  });
  await six.tap();
  const yes = ana.getByRole("button", { name: "Yes, do it" });
  await shot(take, ana, {
    id: "5-confirm",
    beat: "5",
    screen: "member",
    named: { yes },
  });
  await yes.tap();
  const mine = ana.getByRole("button", { name: "18:00, booked by you — tap to give it back" });
  await expect(mine).toBeVisible();
  // One hour a day: every other hour of hers is closed now.
  await expect(ana.getByRole("button", { name: /free — tap to book/ })).toHaveCount(0);
  await shot(take, ana, {
    id: "5-booked",
    beat: "5",
    screen: "member",
    named: { mine },
  });

  // ── 6 · On the board, the booking arrives in the service that stored it ──
  await watchTheRun(page, take, PEOPLE);

  // ── 5b · The race: one hour, two people, the same moment ───────────────
  const free = (who: Page) =>
    who.getByRole("button", { name: "19:00, free — tap to book" }).first();
  for (const who of [page, ana]) {
    const press = who === ana ? (l: ReturnType<Page["getByRole"]>) => l.tap() : (l: ReturnType<Page["getByRole"]>) => l.click();
    await press(who.getByRole("button", { name: "+2", exact: true }));
    await expect(free(who)).toBeVisible();
    await free(who).scrollIntoViewIfNeeded();
    await press(free(who));
    await expect(who.getByRole("button", { name: "Yes, do it" })).toBeVisible();
  }
  await shot(take, page, {
    id: "5b-race-owner",
    beat: "5b",
    screen: "owner",
    named: { yes: page.getByRole("button", { name: "Yes, do it" }) },
  });
  await shot(take, ana, {
    id: "5b-race-member",
    beat: "5b",
    screen: "member",
    named: { yes: ana.getByRole("button", { name: "Yes, do it" }) },
  });
  await Promise.all([
    page.getByRole("button", { name: "Yes, do it" }).click(),
    ana.getByRole("button", { name: "Yes, do it" }).tap(),
  ]);
  const lost = "Court 1 at 19:00 was just taken by someone else.";
  const won = (who: Page) =>
    who.getByRole("button", { name: "19:00, booked by you — tap to give it back" });
  await expect
    .poll(async () => (await won(page).isVisible()) || (await won(ana).isVisible()))
    .toBe(true);
  const samWon = await won(page).isVisible();
  const [winner, loser] = samWon ? [page, ana] : [ana, page];
  await expect(won(winner)).toBeVisible();
  // The one who lost is told, and only they are.
  await expect(loser.getByText(lost)).toBeVisible();
  await expect(winner.getByText(lost)).toHaveCount(0);
  await shot(take, loser, {
    id: "5b-lost",
    beat: "5b",
    screen: loser === ana ? "member" : "owner",
    named: { notice: loser.getByText(lost) },
  });
  await shot(take, winner, {
    id: "5b-won",
    beat: "5b",
    screen: winner === ana ? "member" : "owner",
    named: { mine: won(winner) },
  });
  take.figures.raceWinner = samWon ? SAM.name : ANA.name;

  saveTake(take);
  await close();
});
