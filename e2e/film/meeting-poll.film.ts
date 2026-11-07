import { readFileSync } from "node:fs";

import type { Locator, Page } from "@playwright/test";

import { expect, test } from "../support/test";
import { cast, deployAndShare, memberOpensIt, NODE, signIn } from "./beats";
import { saveTake, shot, startTake } from "./shots";

/**
 * Meeting Poll for the pitch's gallery: the app in use by a team. The board
 * the repository ships, deployed and shared with Ana and Ben. Sam calls a
 * dinner and puts up three dates; Ana and Ben answer on their phones, each as
 * themselves; Sam sees who can make which; he closes the poll, and a late
 * answer from a page that still offered it is turned down by the database.
 *
 * The card opens the browser version; this is what deploying it changes — one
 * poll the team answers, each member as themselves
 * (`plans/TODO-PITCH-SHOWCASE.md`, slide 08).
 */

const PEOPLE = cast("team.example", "Team cloud");
const { sam: SAM, ana: ANA, ben: BEN } = PEOPLE;

const BOARD = JSON.parse(
  readFileSync("../boards/meeting-poll-demo-board.json", "utf8"),
) as { boardName: string };

const MEETING = "Team dinner";
const HOUR = 19;

/** A week out, three evenings in a row: as the picker names the day, and as the poll does. */
const DATES = [7, 8, 9].map((ahead) => {
  const day = new Date();
  day.setDate(day.getDate() + ahead);
  const iso = [day.getFullYear(), day.getMonth() + 1, day.getDate()]
    .map((n) => String(n).padStart(2, "0"))
    .join("-");
  const weekday = day.toLocaleDateString("en-GB", { weekday: "short" });
  return { iso, label: `${weekday} ${iso} at ${HOUR}:00` };
});

/** A date's row on Vote: its label, who answered, the score and its button. */
const row = (who: Page, label: string): Locator =>
  who
    .locator("div")
    .filter({ visible: true })
    .filter({ hasText: label })
    .filter({ has: who.getByRole("button", { name: /Works for me|Take it back/ }) })
    .last();

const answer = (who: Page, label: string) =>
  row(who, label).getByRole("button", { name: "Works for me" }).tap();

/** Sam puts a date up on Organise, through the facade's calendar. */
async function putUp(page: Page, iso: string) {
  // Empty, it asks for a date; after one, it keeps showing that date.
  await page.getByText(/^Pick a date and time$|, \d{4}, \d\d:\d\d [AP]M$/).click();
  const day = page.getByLabel(iso, { exact: true });
  if (!(await day.isVisible())) await page.getByLabel("Next month").click();
  await day.click();
  await page.getByLabel("Hour").selectOption(String(HOUR));
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Propose it" }).click();
}

test.use({ hostConfig: { remotes: [NODE] } });

test("a date the team can make, answered from three screens", async ({
  page,
  browser,
  baseURL,
  seedBoard,
  openBoard,
}) => {
  const take = startTake("meeting-poll");

  await signIn(page, SAM, PEOPLE.coordinator);
  await seedBoard(BOARD.boardName, BOARD);
  await openBoard(BOARD.boardName);
  await expect(page.getByRole("tab", { name: "Organise" })).toBeVisible();

  // Off camera: deployed, with Ana and Ben on the team's list.
  await deployAndShare(page, take, PEOPLE, [BEN]);

  // ── 1 · Sam calls the dinner and puts up three dates ────────────────────
  await page.getByRole("tab", { name: "Organise" }).click();
  await page.getByPlaceholder("Call a new meeting…").fill(MEETING);
  await page.getByRole("button", { name: "Call it" }).click();
  // The field keeps what was typed; called, it is cleared for the next one.
  await page.getByPlaceholder("Call a new meeting…").fill("");
  const heading = page.getByText(`Organising ${MEETING}`, { exact: true });
  await expect(heading).toBeVisible();
  for (const { iso } of DATES) await putUp(page, iso);
  const last = page.getByText(DATES[2].label, { exact: true }).filter({ visible: true });
  await expect(last).toBeVisible();
  await page.mouse.move(0, 0);
  await shot(take, page, {
    id: "1-organise",
    beat: "1",
    screen: "owner",
    named: { heading, first: page.getByText(DATES[0].label, { exact: true }).filter({ visible: true }), last },
  });

  // ── 2 · Ana says which work for her ─────────────────────────────────────
  const { member: ana, close: closeAna } = await memberOpensIt(browser, baseURL, PEOPLE, ANA, BOARD.boardName, take);
  await expect(row(ana, DATES[0].label)).toBeVisible();
  await shot(take, ana, {
    id: "2-vote",
    beat: "2",
    screen: "member",
    named: { dates: row(ana, DATES[0].label), works: row(ana, DATES[0].label).getByRole("button") },
  });
  await answer(ana, DATES[0].label);
  await expect(row(ana, DATES[0].label).getByRole("button", { name: "Take it back" })).toBeVisible();
  await answer(ana, DATES[1].label);
  await expect(row(ana, DATES[1].label).getByRole("button", { name: "Take it back" })).toBeVisible();
  await shot(take, ana, {
    id: "2-answered",
    beat: "2",
    screen: "member",
    named: { first: row(ana, DATES[0].label), second: row(ana, DATES[1].label) },
  });

  // ── 3 · Ben answers as himself, on his own phone ────────────────────────
  const { member: ben, close: closeBen } = await memberOpensIt(browser, baseURL, PEOPLE, BEN, BOARD.boardName);
  await expect(row(ben, DATES[1].label)).toContainText(ANA.name);
  await answer(ben, DATES[1].label);
  const both = row(ben, DATES[1].label);
  await expect(both).toContainText(`${ANA.name}, you`);
  await expect(both).toContainText("2 yes - best so far");
  await shot(take, ben, {
    id: "3-ben",
    beat: "3",
    screen: "member",
    named: { both },
  });

  // ── 4 · Sam sees who can make which ─────────────────────────────────────
  // A member's answer redraws only their own view; Sam sees it on his next look.
  await page.reload();
  const best = row(page, DATES[1].label);
  await expect(best).toContainText(`${ANA.name}, ${BEN.name}`);
  await expect(best).toContainText("2 yes - best so far");
  await page.mouse.move(0, 0);
  await shot(take, page, {
    id: "4-owner",
    beat: "4",
    screen: "owner",
    named: { first: row(page, DATES[0].label), best },
  });

  // ── 5 · He closes the poll; a late answer is turned down ────────────────
  await page.getByRole("tab", { name: "Organise" }).click();
  await page.getByRole("button", { name: "Close the poll" }).click();
  await page.getByRole("button", { name: "Yes, do it" }).click();
  const closed = page.getByText(`Organising ${MEETING} (closed)`, { exact: true });
  await expect(closed).toBeVisible();
  await shot(take, page, {
    id: "5-closed",
    beat: "5",
    screen: "owner",
    named: { closed, reopen: page.getByRole("button", { name: "Reopen the poll" }) },
  });

  const crashes: string[] = [];
  ana.on("pageerror", (error) => crashes.push(error.message));
  // Ana's page still offers the third date: the database is what refuses it.
  await answer(ana, DATES[2].label);
  const refused = ana.getByText(/the poll is closed/);
  await expect(refused).toBeVisible();
  // Told why, without her view failing on the way.
  expect(crashes).toEqual([]);
  await shot(take, ana, {
    id: "5-refused",
    beat: "5",
    screen: "member",
    named: { notice: refused, late: row(ana, DATES[2].label) },
  });

  saveTake(take);
  await closeBen();
  await closeAna();
});
