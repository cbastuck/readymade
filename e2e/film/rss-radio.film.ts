import type { Locator, Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "../support/test";
import { idToken } from "../support/identities";
import { FILM_NODE_URL, FILM_PYTHON_URL } from "../playwright.film.config";
import { cast, NODE, signIn } from "./beats";
import { saveTake, shot, startTake, videoDir } from "./shots";

/**
 * Reading Radio for the pitch's gallery, run for real: the composition opened
 * in the playground against the film's hkp-node and hkp-python, real feeds, a
 * real model writing the briefs, and the voice speaking them. Its face is five
 * lanes; three items are dragged onto the reading list, and the rest happens
 * by itself — briefed, voiced, on air.
 *
 * What is asserted is what the narration says: a kept article is briefed by
 * the model, voiced, and lands on air with a player; a card that fails says
 * why, and the take stops there with the reason. Every runtime's service
 * states are written to test-results/film/rss-radio either way.
 */

const PYTHON = { name: "python", url: FILM_PYTHON_URL, port: 0 };
const PEOPLE = cast("radio.example", "Radio cloud");
const OUT = "test-results/film/rss-radio";
const KEPT = 3;

// The model's key is a secret on this board; a trace would keep what the
// page was given, so none is written.
test.use({ hostConfig: { remotes: [NODE, PYTHON] }, trace: "off" });

const lane = (page: Page, title: string) => page.locator(`section[aria-label="${title}"]`);
const cards = (of: Locator) => of.locator("article[data-card-id]");

/** Waits for `title` to hold `count` cards, failing at once on a failed card upstream. */
async function waitForLane(page: Page, title: string, count: number, timeout: number) {
  const failed = page.locator('section[aria-label="Reading list"], section[aria-label="Briefed"]').locator('[data-status="failed"]');
  await expect
    .poll(
      async () => {
        if (await failed.count()) {
          const card = failed.first().locator("xpath=ancestor::article[1]");
          await page.screenshot({ path: `${OUT}/failed.png` });
          throw new Error(`A card failed: ${await card.innerText()}`);
        }
        return cards(lane(page, title)).count();
      },
      { timeout, intervals: [2_000] },
    )
    .toBeGreaterThanOrEqual(count);
}

/** What every runtime's services say now, read as Sam: where a pass stopped. */
async function dumpStates(page: Page) {
  const auth = { Authorization: `Bearer ${idToken(PEOPLE.sam)}` };
  const states: Record<string, unknown> = {};
  for (const server of [FILM_NODE_URL, FILM_PYTHON_URL]) {
    const listed = await page.request.get(`${server}/runtimes`, { headers: auth }).catch(() => null);
    const { runtimes = [] } = (await listed?.json().catch(() => ({}))) as { runtimes?: Array<{ id: string }> };
    for (const runtime of runtimes) {
      const services = await page.request.get(`${server}/runtimes/${runtime.id}/services`, { headers: auth });
      states[`${server} ${runtime.id}`] = await services.json().catch(() => services.status());
    }
  }
  writeFileSync(`${OUT}/states.json`, JSON.stringify(states, null, 2));
}

test("a reading list, read aloud", async ({ page }) => {
  test.setTimeout(20 * 60_000);
  test.skip(!process.env.ANTHROPIC_API_KEY, "The editor needs ANTHROPIC_API_KEY, handed to the page as the secret anthropic.key");
  const take = startTake("rss-radio");
  mkdirSync(OUT, { recursive: true });

  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") errors.push(`${message.type()}: ${message.text()}`);
  });

  await signIn(page, PEOPLE.sam, PEOPLE.coordinator);
  // The key as the secret the editor names, the way the app's host hands its
  // vault to the page — read from the environment, never written down.
  await page.context().addInitScript((key) => {
    (window as unknown as { __HKP_VAULT__: unknown }).__HKP_VAULT__ = { "anthropic.key": { value: key, audience: [] } };
  }, process.env.ANTHROPIC_API_KEY!);

  try {
    await page.goto("/playground?demo=rss-radio");
    // Sending the key to the editor's runtime is asked first, as it should be:
    // allowed, as the person opening the board would.
    const consent = page.getByRole("button", { name: "Allow", exact: true });
    await expect(consent).toBeVisible({ timeout: 60_000 });
    await consent.click();

    // ── 1 · The lanes: the feeds, and what they offer ──────────────────────
    const sources = lane(page, "Sources");
    const items = lane(page, "Items");
    const reading = lane(page, "Reading list");
    const briefed = lane(page, "Briefed");
    const onAir = lane(page, "On air");
    await expect(cards(sources).first()).toBeVisible({ timeout: 90_000 });
    // The tech feeds only: a pitch is no place to read the world news aloud.
    // Unsubscribed the way the person would, before the first shot.
    await page.getByRole("button", { name: "Delete BBC World" }).click();
    await page.getByRole("button", { name: "Yes, do it" }).click();
    await expect(cards(sources)).toHaveCount(3, { timeout: 30_000 });
    // Items empties while the feeds are read again; counted once it is full.
    await expect.poll(() => cards(items).count(), { timeout: 90_000 }).toBeGreaterThan(KEPT);
    await expect(cards(items).filter({ hasText: "BBC World" })).toHaveCount(0, { timeout: 60_000 });
    await page.mouse.move(0, 0);
    await shot(take, page, {
      id: "1-lanes",
      beat: "1",
      screen: "owner",
      named: { sources, items, reading, briefed, onAir, firstItem: cards(items).first() },
    });

    // ── 2 · Three items onto the reading list ──────────────────────────────
    const titles: string[] = [];
    for (let i = 0; i < KEPT; i++) {
      const item = cards(items).first();
      const id = await item.getAttribute("data-card-id");
      titles.push((await item.locator(":scope > div > div").first().innerText()).trim());
      await item.dragTo(reading, { timeout: 15_000 });
      const arrived = reading.locator(`article[data-card-id="${id}"]`);
      const left = items.locator(`article[data-card-id="${id}"]`);
      const landed = await arrived.waitFor({ state: "visible", timeout: 10_000 }).then(() => true, () => false);
      if (!landed && (await left.count())) {
        // Where the drag did not take, the card's own menu moves it.
        await left.getByRole("button", { name: /^Move / }).click({ timeout: 10_000 });
        await page.getByRole("menuitem", { name: "Move to Reading list" }).click({ timeout: 10_000 });
      }
      await expect(arrived).toBeVisible({ timeout: 15_000 });
      if (i === 0) {
        await page.mouse.move(0, 0);
        await shot(take, page, { id: "2-kept", beat: "2", screen: "owner", named: { reading, card: arrived, items } });
      }
    }
    await page.waitForTimeout(1_500);
    await page.mouse.move(0, 0);
    await shot(take, page, {
      id: "2-reading",
      beat: "2",
      screen: "owner",
      named: { reading, card: cards(reading).first(), status: reading.locator("[data-status]").first() },
    });
    await page.screenshot({ path: `${OUT}/reading.png` });

    // ── 3 · Briefed by the model ───────────────────────────────────────────
    await waitForLane(page, "Briefed", 1, 5 * 60_000);
    await page.mouse.move(0, 0);
    await shot(take, page, {
      id: "3-briefed",
      beat: "3",
      screen: "owner",
      named: { briefed, card: cards(briefed).first(), status: briefed.locator("[data-status]").first(), reading },
    });

    // ── 4 · Voiced, and on air ─────────────────────────────────────────────
    await waitForLane(page, "On air", 1, 12 * 60_000);
    await page.mouse.move(0, 0);
    const first = cards(onAir).first();
    await shot(take, page, {
      id: "4-on-air",
      beat: "4",
      screen: "owner",
      named: { onAir, card: first, player: first.locator("audio"), briefed },
    });

    // ── 5 · All three, if they make it in time: the radio running on ───────
    await waitForLane(page, "On air", KEPT, 8 * 60_000).catch(() => {});
    await page.mouse.move(0, 0);
    await shot(take, page, {
      id: "5-all",
      beat: "5",
      screen: "owner",
      named: { onAir, briefed, reading, sources, items },
    });
    // The episode itself, for the cut to let it speak a few seconds: the one
    // with the most to say, since a page the editor could not read is briefed
    // from its title alone.
    let longest: Locator | undefined;
    let length = -1;
    for (let i = 0; i < (await cards(onAir).count()); i++) {
      const card = cards(onAir).nth(i);
      const said = (await card.innerText()).length;
      if (said > length) [longest, length] = [card, said];
    }
    const audio = longest && (await longest.locator("audio").getAttribute("src"));
    if (longest && audio) {
      const response = await page.request.get(audio);
      const type = response.headers()["content-type"] ?? "";
      const ext = /mpeg|mp3/.test(type) ? "mp3" : /ogg/.test(type) ? "ogg" : "wav";
      const file = `episode.${ext}`;
      writeFileSync(path.join(videoDir("rss-radio"), "footage", file), await response.body());
      take.figures.episodeFile = file;
      take.figures.episodeTitle = (await longest.locator(":scope > div > div").first().innerText()).trim();
    }
    take.figures.kept = titles;
    take.figures.onAir = await cards(onAir).count();
    saveTake(take);
  } finally {
    await dumpStates(page).catch(() => {});
    writeFileSync(`${OUT}/errors.txt`, errors.join("\n"));
  }
});
