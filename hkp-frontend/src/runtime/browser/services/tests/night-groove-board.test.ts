import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The registry first, as the app loads it, so the tracks can build what their
// pipelines name.
import "../../BrowserRegistry";
import TimelineDescriptor from "../Timeline";
import TracksDescriptor from "../BrowserTracks";
import SoundDescriptor from "../Sound";
import { createSlotStore } from "../../../slots";
import document from "../../../../../../boards/night-groove-demo-board.json";
import { linkBlocks } from "../../../../core/linkBlocks";

/**
 * The Night Groove demo board: one timeline, counting beats, arranging a drum
 * groove and a night sky by name. The Show's frames are run through the
 * board's own Band and Scene — its block uses expanded, as loading it does —
 * so what is checked is what would be heard and what the canvas would be given.
 */

// The board as it runs: its blocks expanded, the way loading it does.
const board = linkBlocks(document as any).board as any;
const services = board.services.ui as any[];
const entry = (uuid: string) =>
  structuredClone(services.find((s) => s.uuid === uuid));

const SCENE = [
  "sky",
  "moon",
  "planet",
  "star-1",
  "star-2",
  "star-3",
  "star-4",
  "rocket",
  "comet",
] as const;
type Drawn = Record<(typeof SCENE)[number], any>;

class SilentAudioContext {
  state = "running";
  currentTime = 0;
  resume() {}
  close() {}
}

function makeApp(slots = createSlotStore()) {
  return {
    notify: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
    getRuntimeVariable: vi.fn(() => ({})),
    setRuntimeVariable: vi.fn(),
    slots: () => slots,
  } as any;
}

let slots: ReturnType<typeof createSlotStore>;
let show: any;
let showApp: any;
let band: any;
let scene: any;
let drawnUpTo = 0;
/** Each drum played, at the Show's time in beats. */
let hits: Array<[number, string]> = [];
let now = 0;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.stubGlobal("AudioContext", SilentAudioContext);
  drawnUpTo = 0;
  hits = [];
  // Every Sound on the board is this class, whichever scope built it.
  const probe = SoundDescriptor.create(makeApp(), "b", {} as any, "probe");
  vi.spyOn(Object.getPrototypeOf(probe), "playDrum").mockImplementation(
    function (_ctx: unknown, drum: unknown) {
      hits.push([now, drum as string]);
    },
  );
  probe.destroy();

  slots = createSlotStore();
  slots.set("tempo", entry("tempo").state.value);
  showApp = makeApp(slots);
  show = TimelineDescriptor.create(showApp, "board", {} as any, "show");
  band = TracksDescriptor.create(makeApp(slots), "board", {} as any, "band");
  band.configure(entry("band").state);
  scene = TracksDescriptor.create(makeApp(slots), "board", {} as any, "scene");
  scene.configure(entry("scene").state);
});

afterEach(() => {
  show.destroy();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/**
 * Plays the Show for `ms` and runs each of its frames through the Band and
 * then the Scene, in order — the timelines inside remember the frame before.
 */
async function play(ms: number) {
  show.configure({ ...entry("show").state, running: true });
  vi.advanceTimersByTime(ms);
  const frames = showApp.next.mock.calls.slice(drawnUpTo).map(([, f]: any) => f);
  drawnUpTo = showApp.next.mock.calls.length;
  const out: { t: number; drawn: Drawn }[] = [];
  for (const frame of frames) {
    now = frame.t;
    const carried = await band.process(frame);
    const answers = await scene.process(carried);
    const drawn = Object.fromEntries(SCENE.map((name, i) => [name, answers[i]]));
    out.push({ t: frame.t, drawn: drawn as Drawn });
  }
  return out;
}

function at(frames: { t: number; drawn: Drawn }[], t: number): Drawn {
  return frames.reduce((best, f) =>
    Math.abs(f.t - t) < Math.abs(best.t - t) ? f : best,
  ).drawn;
}

/** Where a drum was hit, in beats, to the frame it fell in. */
function beatsOf(drum: string, from = 0, to = Infinity) {
  return hits
    .filter(([t, d]) => d === drum && t >= from && t < to)
    .map(([t]) => t);
}

/** Whether every hit lies within a frame after one of the beats given, and every beat was hit once. */
function expectOnBeats(played: number[], beats: number[]) {
  // 60 frames a second at 120 BPM: a frame is 1/30 of a beat.
  const frame = 1 / 30 + 1e-9;
  expect(played).toHaveLength(beats.length);
  played.forEach((t, i) => {
    expect(t).toBeGreaterThanOrEqual(beats[i] - 1e-9);
    expect(t - beats[i]).toBeLessThan(frame);
  });
}

/**
 * Four bars at 120 BPM, stopping short of the frame that lands on the loop —
 * that frame is the first beat of the next pass.
 */
const ONE_PASS_MS = 7990;

const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.round((to - from) / step) }, (_, i) => from + i * step);

describe("the Night Groove demo board", () => {
  it("is a tempo, a Show counting beats, a Band, a Scene and a canvas", () => {
    expect(services.map((s) => s.uuid)).toEqual([
      "tempo",
      "show",
      "band",
      "scene",
      "canvas",
    ]);
    expect(entry("tempo").state).toMatchObject({ slot: "tempo", op: "write" });
    expect(entry("show").state).toMatchObject({
      clock: "own",
      unit: "beats",
      tempoSlot: "tempo",
      length: 16,
      loop: true,
    });
    expect(entry("band").state.tracks.map((t: any) => t.name)).toEqual([
      "hats",
      "kick",
      "snare",
      "fill",
    ]);
    expect(entry("scene").state.tracks.map((t: any) => t.name)).toEqual(SCENE);
  });

  it("writes each drum and each motion once, as blocks", () => {
    const doc = document as any;
    expect(doc.blocks.map((b: any) => b.id)).toEqual(["drum", "pop", "fly"]);
    const uses = (uuid: string) =>
      doc.services.ui
        .find((s: any) => s.uuid === uuid)
        .state.tracks.map((t: any) => t.pipeline[0].block)
        .filter(Boolean);
    expect(uses("band")).toEqual(["drum", "drum", "drum", "drum"]);
    expect(uses("scene")).toEqual(["pop", "pop", "pop", "pop", "pop", "fly", "fly"]);
  });

  it("places every name something takes, and nothing takes a name never placed", () => {
    const placed = new Set(entry("show").state.placements.map((p: any) => p.name));
    const taken = new Set<string>();
    JSON.stringify((document as any).services, (key, value) => {
      if (key === "params" && typeof value?.name === "string") {
        taken.add(value.name);
      }
      if (key === "placement" && value) {
        taken.add(value);
      }
      return value;
    });
    expect(taken).toEqual(placed);
  });

  it("passes the Show's frame through the Band unchanged", async () => {
    await play(100);
    const frame = showApp.next.mock.calls.at(-1)[1];
    expect(await band.process(frame)).toEqual(frame);
  });

  it("plays eighth-note hi-hats through all four bars", async () => {
    await play(ONE_PASS_MS);
    expectOnBeats(beatsOf("hihat"), range(0, 16, 0.5));
  });

  it("brings the kick in on the second bar, on every beat", async () => {
    await play(ONE_PASS_MS);
    expectOnBeats(beatsOf("kick"), range(4, 16, 1));
  });

  it("puts the snare on the backbeat of bars three and four, then fills the last two beats", async () => {
    await play(ONE_PASS_MS);
    expectOnBeats(beatsOf("snare"), [9, 11, 13, 14, 14.5, 15, 15.25, 15.5, 15.75]);
  });

  it("follows the tempo: at 60 BPM a bar takes twice as long", async () => {
    slots.set("tempo", 60);
    // Two beats, stopping short of the frame that lands on the third.
    await play(1990);
    expectOnBeats(beatsOf("hihat"), range(0, 2, 0.5));
  });

  it("stays silent while paused", async () => {
    await play(1000);
    const before = hits.length;
    show.configure({ pause: true });
    vi.advanceTimersByTime(2000);
    expect(showApp.next.mock.calls.length).toBe(drawnUpTo);
    expect(hits).toHaveLength(before);
  });

  it("beats the moon with the kick: absent before it, largest on each beat", async () => {
    const frames = await play(8000);
    expect(at(frames, 3.5)["moon"]).toBeNull();
    const moon = (t: number) => Number(at(frames, t)["moon"].radius.replace("%", ""));
    expect(at(frames, 4)["moon"]).toMatchObject({ type: "circle", color: "#fde68a" });
    // Sampled a frame after each beat: the frame nearest the beat may be the
    // last of the one before.
    expect(moon(6.02)).toBeGreaterThan(9.5);
    expect(moon(6.5)).toBeCloseTo(7, 5);
    expect(moon(7.02)).toBeGreaterThan(9.5);
  });

  it("pops a star in on each beat of the first bar", async () => {
    const frames = await play(4000);
    for (const [name, beat] of [
      ["star-1", 0],
      ["star-2", 1],
      ["star-3", 2],
      ["star-4", 3],
    ] as const) {
      if (beat > 0) {
        expect(at(frames, beat - 0.1)[name]).toBeNull();
      }
      expect(at(frames, beat + 0.1)[name]).toMatchObject({ type: "image" });
    }
  });

  it("launches the rocket with the kick and brings the planet in with the snare", async () => {
    const frames = await play(8000);
    expect(at(frames, 3.9)["rocket"]).toBeNull();
    expect(at(frames, 4.1)["rocket"]).toMatchObject({ type: "image" });
    expect(at(frames, 7.9)["planet"]).toBeNull();
    expect(at(frames, 8.1)["planet"]).toMatchObject({ type: "image", height: "45%" });
  });

  it("sends the comet across with the fill", async () => {
    const frames = await play(8000);
    expect(at(frames, 13.9)["comet"]).toBeNull();
    const x = (d: any) => Number(d.centerX.replace("%", ""));
    expect(Math.abs(x(at(frames, 15)["comet"]) - 50)).toBeLessThan(3);
  });

  it("starts the groove over when the show loops", async () => {
    await play(10000);
    const second = beatsOf("hihat").filter((t, i, all) => i > 0 && t < all[i - 1]);
    expect(second).toHaveLength(1);
    expect(beatsOf("kick", 0, 4).length).toBe(0);
  });
});
