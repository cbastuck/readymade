import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";

/**
 * A board's calls to public APIs, recorded once and played back for every
 * later take — the same idea as the assistant's tape (`assistTape.ts`), for a
 * board whose services fetch from the internet, which a take never reaches.
 *
 * Recording (`FILM_HTTP=record FILM_STORY=<slug>`) lets the page fetch from
 * the origins named for real and writes down every answer. Replaying serves
 * them again by address rather than by order, since a board may ask several
 * at once. Only responses are kept, and only from the origins named.
 *
 * The page's clock is set to when the tape was recorded, so what the answers
 * say about time — "3 hours ago" — reads as it did then.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tapeFor = (slug: string) => path.join(HERE, "tapes", `${slug}-http.json`);

type Answer = { method: string; url: string; status: number; contentType: string; body: string };
type Tape = { recordedAt: string; answers: Answer[] };

export type HttpMode = "record" | "replay" | "off";

export function httpMode(slug: string): HttpMode {
  if (process.env.FILM_HTTP === "record") {
    // A recording replaces a story's tape, so only of the story named.
    const story = process.env.FILM_STORY;
    if (!story) throw new Error("FILM_HTTP=record needs FILM_STORY=<story> — the one whose calls to record");
    if (story === slug) return "record";
  }
  return existsSync(tapeFor(slug)) ? "replay" : "off";
}

/**
 * Routes the page's calls to `origins` through the story's tape. Returns
 * what to call once the take is over, which writes a recording down.
 */
export async function useHttpTape(page: Page, slug: string, origins: string[]) {
  const mode = httpMode(slug);
  if (mode === "off") return { mode, finish: () => {} };

  const tape: Tape =
    mode === "replay"
      ? (JSON.parse(readFileSync(tapeFor(slug), "utf8")) as Tape)
      : { recordedAt: new Date().toISOString(), answers: [] };
  const byAddress = new Map(tape.answers.map((answer) => [`${answer.method} ${answer.url}`, answer]));
  if (mode === "replay") await page.clock.setFixedTime(new Date(tape.recordedAt));

  for (const origin of origins) {
    await page.route(`${origin}/**`, async (route) => {
      const request = route.request();
      const key = `${request.method()} ${request.url()}`;
      if (mode === "record") {
        const response = await route.fetch();
        const body = await response.text();
        byAddress.set(key, {
          method: request.method(),
          url: request.url(),
          status: response.status(),
          contentType: response.headers()["content-type"] ?? "application/json",
          body,
        });
        await route.fulfill({ response, body });
        return;
      }
      // A take that asks for something the recording never did fails loudly.
      const answer = byAddress.get(key);
      if (!answer) {
        await route.fulfill({ status: 599, contentType: "text/plain", body: `The tape has no answer for ${key}` });
        return;
      }
      await route.fulfill({
        status: answer.status,
        contentType: answer.contentType,
        headers: { "access-control-allow-origin": "*" },
        body: answer.body,
      });
    });
  }

  return {
    mode,
    finish: () => {
      if (mode !== "record") return;
      mkdirSync(path.dirname(tapeFor(slug)), { recursive: true });
      const recorded: Tape = { recordedAt: tape.recordedAt, answers: [...byAddress.values()] };
      writeFileSync(tapeFor(slug), `${JSON.stringify(recorded, null, 2)}\n`);
    },
  };
}
