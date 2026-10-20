import { readFileSync } from "node:fs";

import { devices, type Page } from "@playwright/test";

import { FILM_NODE_URL } from "../playwright.film.config";
import { idToken, type Person } from "../support/identities";
import { expect, prepareContext, test } from "../support/test";
import { assistMode, assistModel, syntheticTape, useAssistTape } from "./assistTape";
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

const COORDINATOR = { name: "Club cloud", url: `${FILM_NODE_URL}/coordinator` };
const NODE = { name: "node", url: FILM_NODE_URL, port: 0 };

const SAM: Person = { sub: "film|sam", email: "sam@club.example", name: "Sam" };
const ANA: Person = { sub: "film|ana", email: "ana@club.example", name: "Ana" };

const BOARD = JSON.parse(
  readFileSync("../boards/court-booking-demo-board.json", "utf8"),
) as { boardName: string };

/** What Sam asks for in beat 1 — the narration's sentence, as typed. */
const PROMPT =
  "A booking page for our tennis club: three courts, hourly slots from 7 to 21, " +
  "one hour per member a day, booked in the name of whoever is signed in. " +
  "Run it on the node server so the club can share it.";

/** Signed in as `person`, with the club's coordinator kept — before boot. */
async function signIn(page: Page, person: Person) {
  await page.context().addInitScript(
    ([token, coordinators]) => {
      if (!/^https?:$/.test(location.protocol) || window !== window.top) return;
      window.localStorage.setItem("readymade-id-token", token);
      window.localStorage.setItem("hkp-coordinators", coordinators);
    },
    [idToken(person), JSON.stringify([COORDINATOR])] as [string, string],
  );
}

test.use({ hostConfig: { remotes: [NODE] } });

test("from a deployed board to a member's phone", async ({
  page,
  browser,
  baseURL,
  seedBoard,
  openBoard,
}) => {
  const take = startTake();

  await signIn(page, SAM);
  const mode = assistMode();
  if (mode === "off") {
    // No recorded run yet: beats 1–3 are skipped and the take starts from
    // the board the repository ships, which is what the assistant is asked
    // to arrive at.
    await seedBoard(BOARD.boardName, BOARD);
    await openBoard(BOARD.boardName);
  } else {
    // ── 1 · Describe what the club needs ───────────────────────────────────
    const model = assistModel(mode);
    const finishTape = await useAssistTape(page, mode, model);
    const empty = { boardName: BOARD.boardName, runtimes: [], services: {} };
    await seedBoard(empty.boardName, empty);
    await openBoard(empty.boardName);
    await page.getByLabel("Toggle Board Assist").click();
    const panel = page.getByLabel("Board Assist", { exact: true });
    await panel.getByLabel("Context").selectOption("board");
    await panel.locator(".monaco-editor").first().click();
    await page.keyboard.type(PROMPT, { delay: 18 });
    await shot(take, page, {
      id: "1-describe",
      beat: "1",
      screen: "owner",
      named: { panel, prompt: panel.locator(".monaco-editor").first() },
    });
    await panel.getByRole("button", { name: "Send" }).click();

    // ── 2 · A board, not code — and what the conversation took ─────────────
    const apply = panel.getByRole("button", { name: "Apply board" });
    await expect(apply).toBeVisible({ timeout: 4 * 60_000 });
    const usage = panel.getByLabel("Conversation usage");
    await expect(usage).toBeVisible();
    await shot(take, page, {
      id: "2-proposal",
      beat: "2",
      screen: "owner",
      named: {
        panel,
        usage,
        turn: panel.locator(".hkp-assist-usage").last(),
        // The assistant's answer: what it proposed, and where it came from.
        message: panel.locator("article.hkp-assist-assistant").last(),
      },
    });
    const measured = !syntheticTape();
    if (measured) {
      take.figures.assistModel = model;
      take.figures.assistUsage = (await usage.textContent())?.trim();
      take.figures.assistTurnUsage = (
        await panel.locator(".hkp-assist-usage").last().textContent()
      )?.trim();
    }

    // ── 3 · Review what was written; the rest is blocks ────────────────────
    await panel.getByRole("button", { name: "Show changes" }).last().click();
    const review = page.getByLabel("What to review");
    await expect(review.getByTestId("review-blocks")).toContainText("sql");
    await shot(take, page, {
      id: "3-review",
      beat: "3",
      screen: "owner",
      named: {
        review,
        authored: review.getByTestId("review-authored"),
        blocks: review.getByTestId("review-blocks"),
        // The two columns whole, for the camera to move between.
        written: review.locator(":scope > div").nth(0),
        builtFrom: review.locator(":scope > div").nth(1),
      },
    });
    if (measured) {
      take.figures.reviewAuthored = (
        await review.getByTestId("review-authored").textContent()
      )?.trim();
    }
    await page.getByRole("button", { name: "Cancel" }).click();
    await apply.click();
    finishTape();
  }

  // ── 4 · Deploy, and add a member by her address ─────────────────────────
  await expect(page.getByRole("button", { name: /free — tap to book/ }).first()).toBeVisible();
  // A board with a facade opens as its app; the controls are a tap away.
  const controls = page.getByRole("button", { name: "Show the board controls" });
  if (await controls.isVisible()) await controls.click();
  await page.getByTitle("Deploy to a coordinator").click();
  await page.getByText(COORDINATOR.name, { exact: true }).click();
  const dialog = page.getByTestId("deploy-dialog");
  await expect(dialog).toBeVisible();
  await shot(take, page, {
    id: "4-deploy",
    beat: "4",
    screen: "owner",
    named: {
      dialog,
      deploy: page.getByRole("button", { name: "Deploy", exact: true }),
    },
  });
  await page.getByRole("button", { name: "Deploy", exact: true }).click();
  await expect(page).toHaveURL(/cloud-boards/);
  await expect(page.getByText(`Deployed to ${COORDINATOR.name}`)).toBeVisible();

  // Off camera: the board keeps its log, which is what beat 6 watches, and
  // Sam is on his own list under his name, so his bookings carry it.
  await page.getByRole("button", { name: "Logging off" }).click();
  await expect(page.getByRole("button", { name: "Logging on" })).toBeVisible();
  await page.getByRole("button", { name: "Members" }).click();
  await page.getByLabel("Email").fill(SAM.email);
  await page.getByLabel("Name", { exact: true }).fill(SAM.name);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("Members").getByText(SAM.email)).toBeVisible();

  await page.getByLabel("Email").fill(ANA.email);
  await page.getByLabel("Name", { exact: true }).fill(ANA.name);
  await shot(take, page, {
    id: "4-member",
    beat: "4",
    screen: "owner",
    named: {
      email: page.getByLabel("Email"),
      add: page.getByRole("button", { name: "Add", exact: true }),
    },
  });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("Members").getByText(ANA.email)).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  // ── 5 · Ana, on her phone ────────────────────────────────────────────────
  const { defaultBrowserType: _engine, ...iphone } = devices["iPhone 15"];
  const phone = await browser.newContext({ ...iphone, baseURL });
  await prepareContext(phone, {
    profile: "mobile",
    hostConfig: {},
    baseURL,
    serverOrigins: [FILM_NODE_URL],
  });
  const ana = await phone.newPage();
  await signIn(ana, ANA);
  await ana.goto("/");
  // The harness keeps the phone off the internet, so the news card says it is
  // offline; it is not part of the story.
  await ana.getByRole("button", { name: /close|dismiss/i }).first().tap().catch(() => {});
  await shot(take, ana, {
    id: "5-home",
    beat: "5",
    screen: "member",
    named: { cloud: ana.getByText("Cloud Boards", { exact: true }) },
  });
  await ana.getByText("Cloud Boards", { exact: true }).tap();
  await ana.getByText(COORDINATOR.name, { exact: true }).tap();
  await expect(ana.getByText(`Shared with you as “${ANA.name}”`)).toBeVisible();
  await shot(take, ana, {
    id: "5-shared",
    beat: "5",
    screen: "member",
    named: { board: ana.getByText("Court Booking").last() },
  });
  await ana.getByText("Court Booking").last().tap();
  await ana.getByRole("button", { name: "Open board" }).tap();

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
  await page.getByRole("button", { name: "Show the facade and the board" }).click();
  // Whichever service stored the booking: the one whose runs say Ana
  // changed a row — found the way a viewer would, so a board the assistant
  // wrote is filmed the same as the one the repository ships.
  const run = page
    .getByLabel("Recent runs")
    .getByRole("listitem")
    .filter({ hasText: ANA.name })
    .filter({ hasText: "1 row changed" })
    .first();
  await expect(run).toBeVisible();
  const taken = page.locator("[id^='service-frame-']").filter({ has: run });
  await taken.scrollIntoViewIfNeeded();
  await shot(take, page, {
    id: "6-runs",
    beat: "6",
    screen: "owner",
    named: {
      service: taken,
      runs: taken.getByLabel("Recent runs"),
      run,
    },
  });
  await page.getByRole("button", { name: "Show the facade only" }).click();

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
  await phone.close();
});
