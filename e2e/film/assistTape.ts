import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";

/**
 * A real assistant run, recorded once and played back for every later take.
 *
 * Recording (`FILM_ASSIST=record`, with `ANTHROPIC_API_KEY` set) lets the
 * board assistant talk to the Anthropic API for real and writes down every
 * answer it got, in order. Replaying serves those answers again, so a re-shoot
 * costs nothing and shows the same board, the same explanation and the same
 * usage — the figures the video states are the recorded run's, not a guess.
 *
 * Only responses are kept: no request, so no API key, ever reaches the tape.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** The recorded run. `FILM_TAPE` points a rehearsal at another one. */
export const TAPE = process.env.FILM_TAPE ?? path.join(HERE, "tapes", "golden-path.json");
const API = "https://api.anthropic.com";

type Answer = { method: string; path: string; status: number; contentType: string; body: string };
type Tape = {
  recordedAt: string;
  model: string;
  answers: Answer[];
  /**
   * Answers written by hand to rehearse the take's mechanics, not a model's.
   * A take on one records no figures: the video states only measured ones.
   */
  synthetic?: boolean;
};

/** Whether the tape a replay would use was written by hand. */
export function syntheticTape(): boolean {
  return existsSync(TAPE) && !!(JSON.parse(readFileSync(TAPE, "utf8")) as Tape).synthetic;
}

export type AssistMode = "record" | "replay" | "off";

export function assistMode(): AssistMode {
  if (process.env.FILM_ASSIST === "record") {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("FILM_ASSIST=record needs ANTHROPIC_API_KEY for the one real run");
    }
    return "record";
  }
  return existsSync(TAPE) ? "replay" : "off";
}

/** The model the run uses; a recorded tape says which it was. */
export function assistModel(mode: AssistMode): string {
  if (mode === "replay") return (JSON.parse(readFileSync(TAPE, "utf8")) as Tape).model;
  return process.env.FILM_MODEL ?? "claude-opus-5-5";
}

/**
 * Routes the page's calls to the API through the tape. Returns what to call
 * once the take is over, which writes a recording down.
 */
export async function useAssistTape(page: Page, mode: AssistMode, model: string) {
  // Signed in to the API the way a person would be: through the assistant's
  // own settings. A replay needs no key at all.
  await page.context().addInitScript(
    ([token, chosen]) => {
      if (!/^https?:$/.test(location.protocol) || window !== window.top) return;
      window.localStorage.setItem(
        "readymade.ai-assist.v1",
        JSON.stringify({ provider: "anthropic", anthropicToken: token, model: chosen, effort: "default" }),
      );
    },
    [mode === "record" ? process.env.ANTHROPIC_API_KEY! : "replayed", model] as [string, string],
  );

  const answers: Answer[] =
    mode === "replay" ? (JSON.parse(readFileSync(TAPE, "utf8")) as Tape).answers : [];
  let next = 0;

  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const where = new URL(request.url()).pathname;
    if (mode === "record") {
      const response = await route.fetch();
      const body = await response.text();
      answers.push({
        method: request.method(),
        path: where,
        status: response.status(),
        contentType: response.headers()["content-type"] ?? "application/json",
        body,
      });
      await route.fulfill({ response, body });
      return;
    }
    // Played back in the order they were recorded, each to the same kind of
    // request it answered — a take that asks something else fails loudly.
    const answer = answers[next];
    if (!answer || answer.method !== request.method() || answer.path !== where) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          type: "error",
          error: { type: "api_error", message: `The tape has no answer for ${request.method()} ${where} (#${next})` },
        }),
      });
      return;
    }
    next++;
    await route.fulfill({ status: answer.status, contentType: answer.contentType, body: answer.body });
  });

  return () => {
    if (mode !== "record") return;
    mkdirSync(path.dirname(TAPE), { recursive: true });
    const tape: Tape = { recordedAt: new Date().toISOString(), model, answers };
    writeFileSync(TAPE, `${JSON.stringify(tape, null, 2)}\n`);
  };
}
