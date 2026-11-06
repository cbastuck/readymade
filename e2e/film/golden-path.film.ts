import { readFileSync } from "node:fs";

import { expect, test } from "../support/test";
import { anaOpensIt, askTheAssistant, cast, deployAndShare, NODE, signIn, watchTheRun } from "./beats";
import { bookTomorrowAtSix, raceForOneHour } from "./court";
import { saveTake, startTake } from "./shots";

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
const { sam: SAM } = PEOPLE;

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

  await bookTomorrowAtSix(ana, take);

  // ── 6 · On the board, the booking arrives in the service that stored it ──
  await watchTheRun(page, take, PEOPLE);

  // ── 5b · The race: one hour, two people, the same moment ───────────────
  await raceForOneHour(page, ana, take, PEOPLE);

  saveTake(take);
  await close();
});
