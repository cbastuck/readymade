import { devices, type Browser, type Locator, type Page } from "@playwright/test";

import { FILM_NODE_URL } from "../playwright.film.config";
import { idToken, type Person } from "../support/identities";
import { expect, prepareContext } from "../support/test";
import { assistMode, assistModel, syntheticTape, useAssistTape } from "./assistTape";
import { shot, type Take } from "./shots";

/**
 * The beats every story takes the same way, whatever app it builds: two
 * people signed in for real, the assistant asked for a board (beats 1–3), the
 * board deployed and shared (4), a member opening it on a phone (5), and the
 * owner watching what a member did arrive in a service's runs (6). A story's
 * own spec supplies what is particular to its app between them.
 */

export const NODE = { name: "node", url: FILM_NODE_URL, port: 0 };

/** The people and the coordinator a story is told with. */
export function cast(domain: string, coordinatorName: string) {
  return {
    coordinator: { name: coordinatorName, url: `${FILM_NODE_URL}/coordinator` },
    sam: { sub: "film|sam", email: `sam@${domain}`, name: "Sam" } as Person,
    ana: { sub: "film|ana", email: `ana@${domain}`, name: "Ana" } as Person,
  };
}
export type Cast = ReturnType<typeof cast>;

/** Signed in as `person`, with the story's coordinator kept — before boot. */
export async function signIn(page: Page, person: Person, coordinator: Cast["coordinator"]) {
  await page.context().addInitScript(
    ([token, coordinators]) => {
      if (!/^https?:$/.test(location.protocol) || window !== window.top) return;
      window.localStorage.setItem("readymade-id-token", token);
      window.localStorage.setItem("hkp-coordinators", coordinators);
    },
    [idToken(person), JSON.stringify([coordinator])] as [string, string],
  );
}

/**
 * Beats 1–3: Sam types the story's sentence to the assistant on an empty
 * board, the proposal and what the conversation took are filmed, then the
 * review, and the board is applied. Skipped — returning false — when the story
 * has no recorded run and none is being recorded.
 */
export async function askTheAssistant(
  page: Page,
  take: Take,
  options: {
    prompt: string;
    boardName: string;
    seedBoard: (name: string, board: unknown) => Promise<void>;
    openBoard: (name: string) => Promise<void>;
  },
): Promise<boolean> {
  const mode = assistMode(take.slug);
  if (mode === "off") return false;

  // ── 1 · Describe it ──────────────────────────────────────────────────────
  const model = assistModel(take.slug, mode);
  const finishTape = await useAssistTape(page, take.slug, mode, model);
  const empty = { boardName: options.boardName, runtimes: [], services: {} };
  await options.seedBoard(empty.boardName, empty);
  await options.openBoard(empty.boardName);
  await page.getByLabel("Toggle Board Assist").click();
  const panel = page.getByLabel("Board Assist", { exact: true });
  await panel.getByLabel("Context").selectOption("board");
  await panel.locator(".monaco-editor").first().click();
  await page.keyboard.type(options.prompt, { delay: 18 });
  await shot(take, page, {
    id: "1-describe",
    beat: "1",
    screen: "owner",
    named: { panel, prompt: panel.locator(".monaco-editor").first() },
  });
  await panel.getByRole("button", { name: "Send" }).click();

  // ── 2 · A board, not code — and what the conversation took ───────────────
  const apply = panel.getByRole("button", { name: "Apply board" });
  await expect(apply).toBeVisible({ timeout: 6 * 60_000 });
  const usage = panel.getByLabel("Conversation usage");
  await expect(usage).toBeVisible();
  // The answer from its first sentence — a long one starts above the panel's
  // view, where a box would point at whatever covers it.
  const answer = panel.locator("article.hkp-assist-assistant").last().locator("p").first();
  await answer.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await shot(take, page, {
    id: "2-answer",
    beat: "2",
    screen: "owner",
    named: { answer },
    firstSentence: { answerHead: answer },
  });
  await usage.scrollIntoViewIfNeeded();
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
  const measured = !syntheticTape(take.slug);
  if (measured) {
    take.figures.assistModel = model;
    take.figures.assistUsage = (await usage.textContent())?.trim();
    take.figures.assistTurnUsage = (await panel.locator(".hkp-assist-usage").last().textContent())?.trim();
    take.figures.assistAnswer = (
      await panel.locator("article.hkp-assist-assistant").last().locator("p").first().textContent()
    )?.trim();
  }

  // ── 3 · Review what was written; the rest is blocks ──────────────────────
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
    take.figures.reviewAuthored = (await review.getByTestId("review-authored").textContent())?.trim();
    take.figures.reviewBlocks = (await review.getByTestId("review-blocks").textContent())?.trim();
  }
  await page.getByRole("button", { name: "Cancel" }).click();
  await apply.click();
  finishTape();
  return true;
}

/**
 * Beat 4: deploy, then add the member by her address. Off camera the board
 * keeps its log (what beat 6 watches) and Sam is on his own list under his
 * name, so what he does carries it.
 */
export async function deployAndShare(page: Page, take: Take, people: Cast) {
  // A board with a facade opens as its app, the controls a tap away. On some
  // boards the revealed bar retracts again by itself a moment later (see the
  // break log in the plan), so revealing it and opening the deploy menu are
  // one step, repeated until the menu is open.
  const controls = page.getByRole("button", { name: "Show the board controls" });
  const deployMenu = page.getByTitle("Deploy to a coordinator");
  const coordinatorItem = page.getByText(people.coordinator.name, { exact: true });
  await expect(async () => {
    if (!(await deployMenu.isVisible()) && (await controls.isVisible())) {
      await controls.click({ timeout: 2_000 });
    }
    await deployMenu.click({ timeout: 2_000 });
    await expect(coordinatorItem).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await coordinatorItem.click();
  const dialog = page.getByTestId("deploy-dialog");
  await expect(dialog).toBeVisible();
  await shot(take, page, {
    id: "4-deploy",
    beat: "4",
    screen: "owner",
    named: { dialog, deploy: page.getByRole("button", { name: "Deploy", exact: true }) },
  });
  await page.getByRole("button", { name: "Deploy", exact: true }).click();
  await expect(page).toHaveURL(/cloud-boards/);
  await expect(page.getByText(`Deployed to ${people.coordinator.name}`)).toBeVisible();

  await page.getByRole("button", { name: "Logging off" }).click();
  await expect(page.getByRole("button", { name: "Logging on" })).toBeVisible();
  await page.getByRole("button", { name: "Members" }).click();
  await page.getByLabel("Email").fill(people.sam.email);
  await page.getByLabel("Name", { exact: true }).fill(people.sam.name);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("Members").getByText(people.sam.email)).toBeVisible();

  await page.getByLabel("Email").fill(people.ana.email);
  await page.getByLabel("Name", { exact: true }).fill(people.ana.name);
  await shot(take, page, {
    id: "4-member",
    beat: "4",
    screen: "owner",
    named: { email: page.getByLabel("Email"), add: page.getByRole("button", { name: "Add", exact: true }) },
  });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("Members").getByText(people.ana.email)).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
}

/**
 * Beat 5's way in: Ana's phone, signed in, through the Cloud tab to the board
 * shared with her, opened. Returns her page and what closes the phone.
 */
export async function anaOpensIt(
  browser: Browser,
  baseURL: string | undefined,
  take: Take,
  people: Cast,
  /** The board's name in her list; omitted, the first board shared with her. */
  boardTitle?: string,
) {
  const { defaultBrowserType: _engine, ...iphone } = devices["iPhone 15"];
  const phone = await browser.newContext({ ...iphone, baseURL });
  await prepareContext(phone, { profile: "mobile", hostConfig: {}, baseURL, serverOrigins: [FILM_NODE_URL] });
  const ana = await phone.newPage();
  await signIn(ana, people.ana, people.coordinator);
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
  await ana.getByText(people.coordinator.name, { exact: true }).tap();
  await expect(ana.getByText(`Shared with you as “${people.ana.name}”`)).toBeVisible();
  // A board the assistant named is found by what the list says of it.
  const board = boardTitle
    ? ana.getByText(boardTitle).last()
    : ana.getByText(`Shared with you as “${people.ana.name}”`).first();
  await shot(take, ana, {
    id: "5-shared",
    beat: "5",
    screen: "member",
    named: { board },
  });
  await board.tap();
  await ana.getByRole("button", { name: "Open board" }).tap();
  return { ana, close: () => phone.close() };
}

/**
 * Beat 6: on Sam's board, the run Ana began, in the service that `did` names
 * — "1 row changed" for a write. Found the way a viewer would, so a board the
 * assistant wrote is filmed the same as one the repository ships.
 */
export async function watchTheRun(page: Page, take: Take, people: Cast, did = "1 row changed") {
  await page.getByRole("button", { name: "Show the facade and the board" }).click();
  const hers = (within: Page | Locator) =>
    within
      .getByLabel("Recent runs")
      .getByRole("listitem")
      .filter({ hasText: people.ana.name })
      .filter({ hasText: did })
      .first();
  await expect(hers(page)).toBeVisible();
  // Where more than one service changed a row on her behalf — a first visit
  // that also enrolls her, say — the one furthest down the pipeline is the
  // one her action was for.
  const service = page.locator("[id^='service-frame-']").filter({ has: hers(page) }).last();
  const run: Locator = hers(service);
  await service.scrollIntoViewIfNeeded();
  await shot(take, page, {
    id: "6-runs",
    beat: "6",
    screen: "owner",
    named: { service, runs: service.getByLabel("Recent runs"), run },
  });
  await page.getByRole("button", { name: "Show the facade only" }).click();
}
