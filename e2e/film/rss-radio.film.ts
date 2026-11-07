import { expect, test } from "../support/test";
import { writeFileSync } from "node:fs";

import { idToken } from "../support/identities";
import { FILM_NODE_URL, FILM_PYTHON_URL } from "../playwright.film.config";
import { cast, NODE, signIn } from "./beats";

/**
 * Reading Radio, run for real: the composition opened in the playground
 * against the film's hkp-node and hkp-python, real feeds, a real model writing
 * the briefs (ANTHROPIC_API_KEY where the film's hkp-node runs), and the voice
 * speaking them. A rehearsal first — it writes what it sees to
 * test-results/film/rss-radio — and the story once the board does what its
 * docs say.
 */

const PYTHON = { name: "python", url: FILM_PYTHON_URL, port: 0 };
const PEOPLE = cast("radio.example", "Radio cloud");
const OUT = "test-results/film/rss-radio";

// The model's key is a secret on this board; a trace would keep what the
// page was given, so none is written.
test.use({ hostConfig: { remotes: [NODE, PYTHON] }, trace: "off" });

test("a reading list, read aloud", async ({ page }) => {
  test.setTimeout(14 * 60_000);
  test.skip(!process.env.ANTHROPIC_API_KEY, "The editor needs ANTHROPIC_API_KEY where the film's hkp-node runs");

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
  await page.goto("/playground?demo=rss-radio");
  // Sending the key to the editor's runtime is asked first, as it should be:
  // allowed, as the person opening the board would.
  const consent = page.getByRole("button", { name: "Allow", exact: true });
  await expect(consent).toBeVisible({ timeout: 60_000 });
  await consent.click();

  // Restored, or said why not: a failed restore ends the rehearsal at once.
  await page.waitForTimeout(15_000);
  const failed = page.getByText(/Restoring .* failed/);
  if (await failed.isVisible()) {
    await page.screenshot({ path: `${OUT}/failed.png` });
    throw new Error(`Restore failed: ${await page.locator("body").innerText()}`.slice(0, 2000));
  }

  // Three articles onto the reading list: what the editor is given to read.
  const save = page.getByRole("button", { name: "Save", exact: true });
  await expect(save.first()).toBeVisible({ timeout: 60_000 });
  // Saved, an article stays where it is in the list: three different ones.
  for (let i = 0; i < 3; i++) {
    await save.nth(i).click();
    await page.waitForTimeout(1_500);
  }
  await expect.poll(() => page.getByRole("button", { name: "Remove", exact: true }).filter({ visible: true }).count()).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: `${OUT}/saved.png`, fullPage: true });

  // The whole board once: each service's panel, the feed's address among them.
  await page.getByRole("button", { name: "Show the board controls" }).click().catch(() => {});
  await page.getByRole("button", { name: "Show the facade and the board" }).click().catch(() => {});
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: `${OUT}/board.png`, fullPage: true });
  await page.getByRole("button", { name: "Show the facade only" }).click().catch(() => {});

  // Then each face, every minute: the editor's briefs, the radio's episodes.
  for (let minute = 1; minute <= 3; minute++) {
    await page.waitForTimeout(60_000);
    for (const face of ["RSS Aggregator", "Radio Editor", "Radio"]) {
      await page.getByText(face, { exact: true }).first().click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/minute-${minute}-${face.replace(/ /g, "-")}.png`, fullPage: true });
    }
  }
  // What every runtime's services say now, read as Sam: where a pass stopped.
  const auth = { Authorization: `Bearer ${idToken(PEOPLE.sam)}` };
  const states: Record<string, unknown> = {};
  for (const server of [FILM_NODE_URL, FILM_PYTHON_URL]) {
    const listed = await page.request.get(`${server}/runtimes`, { headers: auth });
    const { runtimes = [] } = (await listed.json().catch(() => ({}))) as { runtimes?: Array<{ id: string }> };
    for (const runtime of runtimes) {
      const services = await page.request.get(`${server}/runtimes/${runtime.id}/services`, { headers: auth });
      states[`${server} ${runtime.id}`] = await services.json().catch(() => services.status());
    }
  }
  writeFileSync(`${OUT}/states.json`, JSON.stringify(states, null, 2));
  console.log(errors.slice(0, 80).join("\n"));
});
