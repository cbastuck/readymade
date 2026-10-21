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
/** Where a story's video lives: one folder per story, named by its slug. */
export const videoDir = (slug: string) =>
  path.resolve(HERE, "../../hkp-website/media/readymade-explainer/remotion/videos", slug);
const footage = (slug: string) => path.join(videoDir(slug), "footage");
const shotsFile = (slug: string) => path.join(videoDir(slug), "shots.json");

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
  /** The story, and so the video folder, this take is for. */
  slug: string;
  takenAt: string;
  shots: Shot[];
  /** Figures the narration states, measured on this take. */
  figures: Record<string, unknown>;
};

export function startTake(slug: string): Take {
  mkdirSync(footage(slug), { recursive: true });
  return { slug, takenAt: new Date().toISOString(), shots: [], figures: {} };
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
    /**
     * Boxes of the text itself rather than of the element holding it — for a
     * line drawn across the whole width, whose words take a corner of it.
     */
    text?: Record<string, Locator>;
    /** Boxes of an element's first sentence: the gist of a long answer. */
    firstSentence?: Record<string, Locator>;
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
  for (const [name, locator] of Object.entries(options.text ?? {})) {
    const first = locator.first();
    if (!(await first.isVisible().catch(() => false))) continue;
    boxes[name] = await first.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      // Viewport coordinates, as Playwright's element boxes and the still are.
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
  }
  for (const [name, locator] of Object.entries(options.firstSentence ?? {})) {
    const first = locator.first();
    if (!(await first.isVisible().catch(() => false))) continue;
    boxes[name] = await first.evaluate((el) => {
      // From the start of the text to the end of its first sentence, across
      // whatever inline elements it runs through.
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let started = false;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? "";
        if (!started && text.trim()) {
          range.setStart(node, text.length - text.trimStart().length);
          started = true;
        }
        if (!started) continue;
        const stop = text.search(/[.!?](\s|$)/);
        range.setEnd(node, stop >= 0 ? stop + 1 : text.length);
        if (stop >= 0) break;
      }
      const r = range.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
  }
  const file = `${options.id}.png`;
  await page.screenshot({ path: path.join(footage(take.slug), file) });
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
    previous = JSON.parse(readFileSync(shotsFile(take.slug), "utf8"));
  } catch {
    // A first take.
  }
  writeFileSync(
    shotsFile(take.slug),
    `${JSON.stringify(
      { ...take, figures: { ...(previous.figures ?? {}), ...take.figures } },
      null,
      2,
    )}\n`,
  );
}
