import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Locator, Page } from "@playwright/test";

/**
 * What the shoot hands the video: a still per shot, and beside it the boxes
 * of the things the narration names, so the composition frames and lights
 * them from where they really were rather than from positions tuned by hand.
 *
 * Stills land in the video's `footage/` (generated, not committed); the list
 * of shots and their boxes is `shots.json` beside it (committed), with the
 * figures the video states — a token count — measured on the take.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const VIDEO_DIR = path.resolve(
  HERE,
  "../../hkp-website/media/readymade-explainer/remotion/videos/golden-path",
);
const FOOTAGE = path.join(VIDEO_DIR, "footage");
const SHOTS = path.join(VIDEO_DIR, "shots.json");

export type Box = { x: number; y: number; width: number; height: number };

export type Shot = {
  /** Unique within the take; the video refers to a shot by it. */
  id: string;
  /** The beat of the story it belongs to, as the plan numbers them. */
  beat: string;
  /** Which person's screen: the owner's desktop or the member's phone. */
  screen: "owner" | "member";
  file: string;
  /** The page's size in CSS pixels; the still is `scale` times that. */
  viewport: { width: number; height: number };
  scale: number;
  /** Named boxes in CSS pixels, from the top left of the page. */
  boxes: Record<string, Box>;
};

export type Take = {
  takenAt: string;
  shots: Shot[];
  /** Figures the narration states, measured on this take. */
  figures: Record<string, unknown>;
};

export function startTake(): Take {
  mkdirSync(FOOTAGE, { recursive: true });
  return { takenAt: new Date().toISOString(), shots: [], figures: {} };
}

/**
 * One still of `page`, with the box of every locator in `named` that is on
 * screen. A named thing that is not visible is left out rather than guessed,
 * and the video's check for its boxes then says which.
 */
export async function shot(
  take: Take,
  page: Page,
  options: {
    id: string;
    beat: string;
    screen: Shot["screen"];
    named?: Record<string, Locator>;
  },
): Promise<Shot> {
  // Let a transition or a toast finish arriving before the still.
  await page.waitForTimeout(350);
  const boxes: Record<string, Box> = {};
  for (const [name, locator] of Object.entries(options.named ?? {})) {
    const first = locator.first();
    if (!(await first.isVisible().catch(() => false))) continue;
    const box = await first.boundingBox();
    if (box) boxes[name] = box;
  }
  const file = `${options.id}.png`;
  await page.screenshot({ path: path.join(FOOTAGE, file) });
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const scale = await page.evaluate(() => window.devicePixelRatio);
  const entry: Shot = {
    id: options.id,
    beat: options.beat,
    screen: options.screen,
    file,
    viewport,
    scale,
    boxes,
  };
  take.shots = [...take.shots.filter((s) => s.id !== entry.id), entry];
  return entry;
}

/** Writes the take's list, keeping figures an earlier take measured. */
export function saveTake(take: Take): void {
  let previous: Partial<Take> = {};
  try {
    previous = JSON.parse(readFileSync(SHOTS, "utf8"));
  } catch {
    // A first take.
  }
  writeFileSync(
    SHOTS,
    `${JSON.stringify(
      { ...take, figures: { ...(previous.figures ?? {}), ...take.figures } },
      null,
      2,
    )}\n`,
  );
}
