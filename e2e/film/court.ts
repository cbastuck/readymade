import type { Locator, Page } from "@playwright/test";

import { expect } from "../support/test";
import type { Cast } from "./beats";
import { shot, type Take } from "./shots";

/**
 * The court-booking board's own beats, the same in every story it is filmed
 * in: Ana takes tomorrow at six on her phone (5), then she and Sam reach for
 * one hour at once and the one who loses is told (5b). Asserted is what the
 * narration says of them; a beat that is not true fails the take.
 */

/** Beat 5: tomorrow, court 2, six o'clock — and the rest of her day closes. */
export async function bookTomorrowAtSix(ana: Page, take: Take) {
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
}

/**
 * Beat 5b: one hour, two people, the same moment. Records who won in the
 * take's figures, since the cut puts each screen where its person is.
 */
export async function raceForOneHour(page: Page, ana: Page, take: Take, people: Cast) {
  const free = (who: Page) =>
    who.getByRole("button", { name: "19:00, free — tap to book" }).first();
  for (const who of [page, ana]) {
    const press = who === ana ? (l: Locator) => l.tap() : (l: Locator) => l.click();
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
  take.figures.raceWinner = samWon ? people.sam.name : people.ana.name;
}
