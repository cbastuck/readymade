import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { devices, type Page } from "@playwright/test";

import { FILM_RT_BIN, FILM_RT_URL } from "../playwright.film.config";
import { expect, prepareContext, test } from "../support/test";
import { saveTake, shot, startTake, videoDir } from "./shots";

/**
 * Live Radio for the pitch's gallery, run for real on hkp-rt: the board's
 * microphone is BlackHole, a virtual device a voice is spoken into (`say -a`),
 * so the take is the same whoever runs it and wherever it is quiet. Start puts
 * it on air; a phone opens the player page the QR code names and listens; the
 * owner sees one listener; and what the stream carried while the voice spoke
 * is brought back for the cut to play.
 *
 * What is asserted is what the narration says: Start puts the endpoint online
 * with a player address, the phone is counted as a listener, and the stream
 * carried sound — decoded in the phone's browser and measured, so a take with
 * the microphone refused (macOS asks the first time) fails instead of filming
 * silence.
 *
 * Needs hkp-rt built (`hkp-rt/run-tests.sh`) and BlackHole 2ch installed.
 */

const DEVICE = "BlackHole 2ch";
const VOICE = "Daniel";
const SAID = "Good evening, this is Live Radio: from a laptop's microphone, to your phone.";

const EMBEDDED = { name: "embedded", url: FILM_RT_URL, port: 0 };

test.use({ hostConfig: { remotes: [EMBEDDED] } });

type Board = {
  boardName: string;
  services: Record<string, Array<{ uuid: string; state?: Record<string, unknown> }>>;
};

/** The demo board, listening to BlackHole: two channels, so the encoder takes two. */
function boardOnBlackHole(): Board {
  const board = JSON.parse(readFileSync("../boards/live-radio-demo-board.json", "utf8")) as Board;
  const [mic, radio] = ["mic", "radio"].map((uuid) => board.services.rt.find((s) => s.uuid === uuid)!);
  mic.state = { ...mic.state, preferredInputDeviceName: DEVICE };
  const [encode] = radio.state!.onProcess as Array<{ state: Record<string, unknown> }>;
  encode.state = { ...encode.state, channels: 2 };
  return board;
}

/** A text widget of the facade by its label: the line holding label and value. */
const labelled = (page: Page, label: string) => page.getByText(label, { exact: true }).first().locator("..");
/** The value after a label, once there is one. */
async function valueOf(page: Page, label: string): Promise<string> {
  const read = async () => ((await labelled(page, label).textContent()) ?? "").replace(label, "").trim();
  await expect.poll(read, { timeout: 15_000 }).not.toBe("");
  return read();
}

/** Speaks `text` into `device` and resolves once it has been said. */
function speak(text: string, device: string, voice: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const say = spawn("say", ["-a", device, "-v", voice, text], { stdio: "ignore" });
    say.on("error", reject);
    say.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`say exited with ${code}`))));
  });
}

/** The stream from now until `until` settles, as the bytes a listener got. */
async function record(url: string, until: Promise<unknown>): Promise<Buffer> {
  const stop = new AbortController();
  const response = await fetch(url, { signal: stop.signal });
  expect(response.headers.get("content-type")).toContain("audio/mpeg");
  const chunks: Buffer[] = [];
  const reading = (async () => {
    const reader = response.body!.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
      }
    } catch {
      // Aborted: the recording is over.
    }
  })();
  await until;
  // What was said is a fraction of a second behind on the stream.
  await new Promise((resolve) => setTimeout(resolve, 800));
  stop.abort();
  await reading;
  return Buffer.concat(chunks);
}

test("your microphone on air, for any phone that scans the code", async ({ page, browser, seedBoard, openBoard }) => {
  test.skip(!FILM_RT_BIN, "Live Radio needs hkp-rt built (hkp-rt/run-tests.sh)");
  test.setTimeout(3 * 60_000);
  const take = startTake("live-radio");

  const board = boardOnBlackHole();
  await seedBoard(board.boardName, board);
  await openBoard(board.boardName);

  // ── 1 · The station, off air ───────────────────────────────────────────
  const start = page.getByRole("button", { name: "Start", exact: true });
  const stop = page.getByRole("button", { name: "Stop", exact: true });
  await expect(start).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Press Start to go on air")).toBeVisible();
  // The station is what lies between its count and its buttons: the facade's
  // container fills the window, so the cut frames `listeners+stop`.
  await page.mouse.move(0, 0);
  await shot(take, page, {
    id: "1-off",
    beat: "1",
    screen: "owner",
    named: { listeners: labelled(page, "Listening:"), start, stop },
  });

  // ── 2 · On air: a code to scan, the address it names ───────────────────
  await start.click();
  await expect(page.getByText("Press Start to go on air")).toHaveCount(0, { timeout: 30_000 });
  const qr = page.locator("canvas").filter({ visible: true }).first();
  await expect(qr).toBeVisible();
  const player = await valueOf(page, "Player:");
  const stream = await valueOf(page, "Stream (VLC):");
  expect(player).toMatch(/^http:\/\/.+\/hosted\//);
  expect(stream).toMatch(/live\.mp3$/);
  await page.waitForTimeout(1_000);
  await page.mouse.move(0, 0);
  await shot(take, page, {
    id: "2-on-air",
    beat: "2",
    screen: "owner",
    named: {
      qr,
      caption: page.getByText("Scan to listen"),
      player: labelled(page, "Player:"),
      listeners: labelled(page, "Listening:"),
      stop,
    },
  });

  // ── 3 · A phone opens the player page and listens ──────────────────────
  const { defaultBrowserType: _engine, ...iphone } = devices["iPhone 15"];
  const phone = await browser.newContext({ ...iphone });
  await prepareContext(phone, { profile: "web", hostConfig: {}, serverOrigins: [FILM_RT_URL] });
  const listener = await phone.newPage();
  try {
    await listener.goto(player);
    const listen = listener.getByRole("button", { name: /listen/i }).first();
    await expect(listen).toBeVisible();
    await shot(take, listener, { id: "3-player", beat: "3", screen: "member", named: { listen } });
    await listen.tap();
    await expect(labelled(page, "Listening:")).toHaveText(/Listening:\s*1/, { timeout: 15_000 });
    // Before the take's own recording joins, which the station counts too.
    await page.mouse.move(0, 0);
    await shot(take, page, {
      id: "4-listener",
      beat: "4",
      screen: "owner",
      named: { listeners: labelled(page, "Listening:"), qr, stop },
    });

    // ── 4 · On air: a voice into the microphone, out of the stream ───────
    const spoken = speak(SAID, DEVICE, VOICE);
    const recorded = record(stream, spoken);
    await listener.waitForTimeout(2_500);
    const status = listener.getByText(/buffered|live/i).last();
    await shot(take, listener, { id: "3-listening", beat: "3", screen: "member", named: { status } });
    const broadcast = await recorded;
    expect(broadcast.length).toBeGreaterThan(16_000);

    // What the stream carried, decoded the way the phone's browser decodes it:
    // a voice, not the silence of a microphone nobody let it open.
    const heard = await listener.evaluate(async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const audio = await new OfflineAudioContext(1, 1, 48_000).decodeAudioData(bytes.buffer);
      const samples = audio.getChannelData(0);
      let sum = 0;
      let peak = 0;
      let first = -1;
      for (let i = 0; i < samples.length; i++) {
        const level = Math.abs(samples[i]);
        sum += level * level;
        peak = Math.max(peak, level);
        if (first < 0 && level > 0.02) first = i;
      }
      return {
        seconds: audio.duration,
        rms: Math.sqrt(sum / samples.length),
        peak,
        // Where the voice begins in the recording: where the cut's clip starts.
        voiceAt: first < 0 ? 0 : first / audio.sampleRate,
      };
    }, broadcast.toString("base64"));
    expect(heard.peak, "the stream is silent: was the microphone allowed?").toBeGreaterThan(0.05);

    writeFileSync(path.join(videoDir("live-radio"), "footage", "broadcast.mp3"), broadcast);
    take.figures.broadcastFile = "broadcast.mp3";
    take.figures.broadcastSeconds = Math.round(heard.seconds * 10) / 10;
    take.figures.voiceAt = Math.round(heard.voiceAt * 100) / 100;
    take.figures.said = SAID;
    take.figures.listeners = 1;
  } finally {
    await phone.close();
  }

  await stop.click();
  saveTake(take);
});
