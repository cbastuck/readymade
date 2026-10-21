import type { Locator, Page } from "@playwright/test";

import { expect, test } from "../support/test";
import { anaOpensIt, askTheAssistant, cast, deployAndShare, NODE, signIn, watchTheRun } from "./beats";
import { syntheticTape } from "./assistTape";
import { saveTake, shot, startTake } from "./shots";

/**
 * Shared costs, filmed: an app nobody shipped. Sam asks the assistant for a
 * Splitwise for his flat; there is no board like it in the repository, so the
 * assistant has to compose one from blocks. Sam deploys it and adds Ana; Ana
 * adds the groceries on her phone; Sam opens it and sees what he owes her.
 *
 * Unlike the golden path, the board is the model's own, so nothing here knows
 * its services or its widgets: everything is found the way a viewer would
 * find it — a field by what it asks for, a button by what it says. What is
 * asserted is what the narration claims: the expense is Ana's, by the server's
 * word; it is split between the two of them; Sam sees half of it as his.
 *
 * The story is in `plans/TODO-GOLDEN-PATH-VIDEO.md` ("A second story").
 */

const SLUG = "shared-costs";
const PEOPLE = cast("flat.example", "Flat cloud");
const { ana: ANA } = PEOPLE;

/** What Sam asks for in beat 1 — the narration's sentence, as typed. */
const PROMPT =
  "An app for our flat to share costs, like Splitwise: whoever paid adds what it " +
  "was for and how much, it is split evenly between everyone in the flat, and each " +
  "of us sees what we owe or are owed. Everyone who opens the board joins the flat. " +
  "Record each expense in the name of whoever is signed in. Run it on the node " +
  "server so we can share it.";

const EXPENSE = { what: "Groceries", amount: "30", half: "15" };

/** A field of the form, found by what it asks for — label or placeholder. */
async function field(page: Page, asks: RegExp, fallback: number): Promise<Locator> {
  const fields = page.getByRole("textbox");
  const count = await fields.count();
  for (let i = 0; i < count; i++) {
    const candidate = fields.nth(i);
    const says = [
      await candidate.getAttribute("aria-label"),
      await candidate.getAttribute("placeholder"),
      await candidate.getAttribute("name"),
    ].join(" ");
    if (asks.test(says)) return candidate;
  }
  return fields.nth(fallback);
}

test.use({ hostConfig: { remotes: [NODE] } });

test("an app nobody shipped, from a sentence to a flatmate's phone", async ({
  page,
  browser,
  baseURL,
  seedBoard,
  openBoard,
}) => {
  const take = startTake(SLUG);

  await signIn(page, PEOPLE.sam, PEOPLE.coordinator);
  const asked = await askTheAssistant(page, take, {
    prompt: PROMPT,
    boardName: "Flat Costs",
    seedBoard,
    openBoard,
  });
  // No board ships for this: without a recorded run there is nothing to film.
  test.skip(!asked, "Record a run first: FILM_ASSIST=record ANTHROPIC_API_KEY=… npm run film -- shared-costs");

  // The board the assistant made is up and asking for an expense.
  await expect(page.getByRole("textbox").first()).toBeVisible();

  // ── 4 · Deploy, and add a flatmate by her address ───────────────────────
  // Deployed, the board opens as Sam's — which is him joining the flat.
  await deployAndShare(page, take, PEOPLE);
  await expect(page.getByRole("textbox").first()).toBeVisible();

  // ── 5 · Ana, on her phone: she paid for the groceries ───────────────────
  const { ana, close } = await anaOpensIt(browser, baseURL, take, PEOPLE);
  // One field ("Groceries 30") or two (what, then how much): whichever the
  // assistant made, filled the way a person would.
  const fields = ana.getByRole("textbox");
  await expect(fields.first()).toBeVisible();
  const single = (await fields.count()) === 1;
  const what = single ? fields.first() : await field(ana, /what|descri|for|item|note|title/i, 0);
  const amount = single ? fields.first() : await field(ana, /amount|how much|€|eur|cost|price|paid|sum/i, 1);
  if (single) {
    await what.fill(`${EXPENSE.what} ${EXPENSE.amount}`);
  } else {
    // A facade's text field submits one value; a two-field form keeps the
    // first in the facade's state when it is entered.
    await what.fill(EXPENSE.what);
    await what.press("Enter");
    await amount.fill(EXPENSE.amount);
  }
  const add = ana.getByRole("button", { name: /add|save|record|log|paid|split/i }).last();
  await shot(take, ana, {
    id: "5-form",
    beat: "5",
    screen: "member",
    named: { what, amount, add },
  });
  if (await add.isVisible()) await add.tap();
  else await amount.press("Enter");

  // She is owed half of it — on whatever she sees first.
  const half = new RegExp(`\\b${EXPENSE.half}(\\.00)?\\b`);
  const owed = ana.getByText(half).filter({ visible: true }).first();
  await expect(owed).toBeVisible();
  await owed.scrollIntoViewIfNeeded();
  await shot(take, ana, {
    id: "5-added",
    beat: "5",
    screen: "member",
    named: { owed },
    text: { owedText: owed },
  });
  // And the expense is listed — on a tab of its own, where the board has one.
  const expensesTab = ana.getByRole("tab", { name: /expense/i }).or(ana.getByRole("button", { name: /^expenses$/i }));
  if (await expensesTab.first().isVisible()) await expensesTab.first().tap();
  const listed = ana.getByText(EXPENSE.what, { exact: false }).filter({ visible: true }).last();
  await expect(listed).toBeVisible();
  // A board with tabs keeps the others in the page, hidden: only what is on
  // screen counts.
  await expect(
    ana.getByText(new RegExp(`\\b${EXPENSE.amount}(\\.00)?\\b`)).filter({ visible: true }).first(),
  ).toBeVisible();
  await shot(take, ana, {
    id: "5-listed",
    beat: "5",
    screen: "member",
    named: { listed },
  });

  // ── 6 · On the board, Ana's expense arrives in the service that stored it ──
  // Watched before Sam looks again: what Runs shows is what arrived while his
  // view was open, and a reload starts it afresh.
  await watchTheRun(page, take, PEOPLE);


  // ── 5b · Sam opens it: what he owes, without anybody doing the sums ─────
  // A member's action redraws only her own view; Sam sees it on his next look.
  await page.reload();
  const controls = page.getByRole("button", { name: "Show the board controls" });
  await expect(page.getByRole("textbox").first().or(controls)).toBeVisible();
  const owes = page.getByText(half).filter({ visible: true }).first();
  await expect(owes).toBeVisible();
  await expect(page.getByText(ANA.name).filter({ visible: true }).first()).toBeVisible();
  await shot(take, page, {
    id: "5b-owes",
    beat: "5b",
    screen: "owner",
    named: { owes, ana: page.getByText(ANA.name).filter({ visible: true }).first() },
    text: { owesText: owes, anaText: page.getByText(ANA.name).filter({ visible: true }).first() },
  });
  // A figure only from a model's board, never from a hand-written rehearsal.
  if (!syntheticTape(SLUG)) take.figures.samOwes = (await owes.textContent())?.trim();

  saveTake(take);
  await close();
});
