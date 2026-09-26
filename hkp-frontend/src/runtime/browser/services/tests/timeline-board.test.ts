import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The registry first, as the app loads it, so the tracks can build what their
// pipelines name.
import "../../BrowserRegistry";
import TimelineDescriptor from "../Timeline";
import TracksDescriptor from "../BrowserTracks";
import document from "../../../../../../boards/timeline-demo-board.json";
import { linkBlocks } from "../../../../core/linkBlocks";

/**
 * The Timeline demo board: images animated by keyframes, each on a timeline of
 * its own, driven by one clock. The Show's frames are run through the board's
 * own Scene — its block uses expanded, as loading it does — so what is checked
 * is what the canvas would be given.
 */

// The board as it runs: its blocks expanded, the way loading it does.
const board = linkBlocks(document as any).board as any;
const services = board.services.ui as any[];
const entry = (uuid: string) =>
  structuredClone(services.find((s) => s.uuid === uuid));

const TRACKS = [
  "sky",
  "planet",
  "star-1",
  "star-2",
  "star-3",
  "star-4",
  "rocket",
  "comet",
] as const;
type Drawn = Record<(typeof TRACKS)[number], any>;

function makeApp() {
  return {
    notify: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
    getRuntimeVariable: vi.fn(() => ({})),
    setRuntimeVariable: vi.fn(),
  } as any;
}

let show: any;
let showApp: any;
let scene: any;
let drawnUpTo = 0;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  drawnUpTo = 0;
  showApp = makeApp();
  show = TimelineDescriptor.create(showApp, "board", {} as any, "show");
  scene = TracksDescriptor.create(makeApp(), "board", {} as any, "scene");
  scene.configure(entry("scene").state);
});

afterEach(() => {
  show.destroy();
  vi.useRealTimers();
});

/**
 * Plays the Show for `ms` and runs each of its frames through the Scene, in
 * order — the timelines inside remember the frame before.
 */
async function play(ms: number) {
  show.configure(entry("show").state);
  vi.advanceTimersByTime(ms);
  const frames = showApp.next.mock.calls.slice(drawnUpTo).map(([, f]: any) => f);
  drawnUpTo = showApp.next.mock.calls.length;
  const out: { t: number; drawn: Drawn }[] = [];
  for (const frame of frames) {
    const answers = await scene.process(frame);
    const drawn = Object.fromEntries(TRACKS.map((name, i) => [name, answers[i]]));
    out.push({ t: frame.t, drawn: drawn as Drawn });
  }
  return out;
}

function at(frames: { t: number; drawn: Drawn }[], t: number): Drawn {
  return frames.reduce((best, f) =>
    Math.abs(f.t - t) < Math.abs(best.t - t) ? f : best,
  ).drawn;
}

describe("the Timeline demo board", () => {
  it("is a Show with its own clock, a Scene of one track per image, and a canvas", () => {
    expect(services.map((s) => s.uuid)).toEqual(["show", "scene", "canvas"]);
    expect(entry("show").state).toMatchObject({
      clock: "own",
      length: 8,
      loop: true,
      running: true,
    });
    expect(entry("scene").state.tracks.map((t: any) => t.name)).toEqual(TRACKS);
  });

  it("writes the motions once, as blocks, and every image is a use of one", () => {
    expect((document as any).blocks.map((b: any) => b.id)).toEqual(["pop", "fly"]);
    const uses = (document as any).services.ui[1].state.tracks
      .slice(1)
      .map((t: any) => t.pipeline[0].block);
    expect(uses).toEqual(["pop", "pop", "pop", "pop", "pop", "fly", "fly"]);
  });

  it("carries images the browser can read", () => {
    const urls = new Set<string>();
    JSON.stringify(document, (_key, value) => {
      if (typeof value === "string" && value.startsWith("data:image/svg+xml,")) {
        urls.add(value);
      }
      return value;
    });
    expect(urls.size).toBe(3);
    for (const url of urls) {
      const svg = decodeURIComponent(url.slice("data:image/svg+xml,".length));
      const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
      expect(parsed.getElementsByTagName("parsererror")).toHaveLength(0);
      expect(parsed.documentElement.tagName).toBe("svg");
    }
  });

  it("pops the first star in: growing past its size, then settling", async () => {
    const frames = await play(1000);
    const scales = frames
      .filter((f) => f.t <= 0.8)
      .map((f) => f.drawn["star-1"].scale);
    expect(scales[0]).toBe(0);
    expect(Math.max(...scales)).toBeCloseTo(1.25, 1);
    expect(at(frames, 1)["star-1"]).toMatchObject({
      type: "image",
      centerX: "18%",
      centerY: "25%",
      scale: 1,
    });
  });

  it("turns each star a full circle over its three seconds, then leaves it out", async () => {
    const frames = await play(4000);
    // Frames fall every 33 ms; halfway through its turn a star moves about 6°
    // a frame, so "halfway" is within a frame of 180°.
    expect(Math.abs(at(frames, 1.5)["star-1"].rotate - 180)).toBeLessThan(7);
    // Fading out towards the end of its stretch, faster as it goes.
    const opacity = (t: number) => at(frames, t)["star-1"].opacity;
    expect(opacity(2)).toBe(1);
    expect(opacity(2.6)).toBeLessThan(1);
    expect(opacity(2.9)).toBeLessThan(opacity(2.6) - 0.3);
    expect(at(frames, 3.5)["star-1"]).toBeNull();
    // Each star starts where its offset says, so the second is behind the first.
    expect(at(frames, 1.5)["star-2"].rotate).toBeLessThan(180);
  });

  it("brings the planet in at the finale, and nothing before it", async () => {
    const frames = await play(8000);
    expect(at(frames, 4)["planet"]).toBeNull();
    const planet = at(frames, 6)["planet"];
    expect(planet).toMatchObject({ type: "image", height: "45%", centerX: "50%" });
    expect(Math.abs(planet.rotate - 180)).toBeLessThan(7);
  });

  it("flies the rocket across, tilting as it goes", async () => {
    const frames = await play(8000);
    expect(at(frames, 2)["rocket"]).toBeNull();
    const start = at(frames, 2.6)["rocket"];
    const middle = at(frames, 4.5)["rocket"];
    const late = at(frames, 6.4)["rocket"];
    const x = (d: any) => Number(d.centerX.replace("%", ""));
    expect(x(start)).toBeLessThan(x(middle));
    expect(Math.abs(x(middle) - 50)).toBeLessThan(2);
    expect(x(middle)).toBeLessThan(x(late));
    expect(start.rotate).toBeLessThan(late.rotate);
    expect(at(frames, 7)["rocket"]).toBeNull();
  });

  it("keyframes the sky's colour from night to dusk", async () => {
    const frames = await play(8000);
    expect(at(frames, 0)["sky"]).toMatchObject({ type: "rect", color: "#0b1026" });
    expect(at(frames, 4.5)["sky"].color).toBe("#312e81");
  });

  it("starts every image over when the show loops", async () => {
    const frames = await play(9000);
    const second = frames.filter((f, i) => i > 0 && f.t < frames[i - 1].t);
    expect(second).toHaveLength(1);
    const after = frames.slice(frames.indexOf(second[0]));
    expect(at(after, 0.8)["star-1"]).toMatchObject({ scale: 1 });
  });
});
