import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The registry first, as the app loads it, so the tracks can build what their
// pipelines name.
import "../../BrowserRegistry";
import TimelineDescriptor from "../Timeline";
import TracksDescriptor from "../BrowserTracks";
import SoundDescriptor from "../Sound";
import { createSlotStore } from "../../../slots";
import document from "../../../../../../boards/pad-groove-demo-board.json";
import { linkBlocks } from "../../../../core/linkBlocks";

/**
 * The Pad Groove demo board: a pad, a bass line and drums, arranged by name on
 * one timeline counting beats. The Song's frames are run through the board's
 * own Band — its block uses expanded, as loading it does — and every note and
 * drum it plays is recorded at the Song's time.
 */

// The board as it runs: its blocks expanded, the way loading it does.
const board = linkBlocks(document as any).board as any;
const services = board.services.ui as any[];
const entry = (uuid: string) =>
  structuredClone(services.find((s) => s.uuid === uuid));

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

type Played = { t: number; part: string; sound: string; seconds?: number };

let slots: ReturnType<typeof createSlotStore>;
let song: any;
let songApp: any;
let band: any;
let played: Played[] = [];
let now = 0;
let playedUpTo = 0;

/** Which part a synth is, told by its wave: each part plays on its own. */
const PART_BY_WAVE: Record<string, string> = { soft: "pad", triangle: "bass" };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.stubGlobal("AudioContext", SilentAudioContext);
  played = [];
  playedUpTo = 0;
  // Every Sound on the board is this class, whichever scope built it.
  const probe = SoundDescriptor.create(makeApp(), "b", {} as any, "probe");
  const proto = Object.getPrototypeOf(probe);
  vi.spyOn(proto, "playDrum").mockImplementation(function (_ctx: unknown, drum: unknown) {
    played.push({ t: now, part: "drums", sound: drum as string });
  });
  vi.spyOn(proto, "playNoteByName").mockImplementation(function (this: any, _ctx: unknown, note: unknown, tempo: unknown) {
    played.push({
      t: now,
      part: PART_BY_WAVE[this.state.waveType] ?? this.state.waveType,
      sound: note as string,
      seconds: this.noteSeconds(tempo),
    });
  });
  probe.destroy();

  slots = createSlotStore();
  slots.set("tempo", entry("tempo").state.value);
  songApp = makeApp(slots);
  song = TimelineDescriptor.create(songApp, "board", {} as any, "song");
  // No slots for the Band: a track's slots are its own, so the tempo reaches
  // its synths in the Song's frames or not at all.
  band = TracksDescriptor.create(makeApp(), "board", {} as any, "band");
  band.configure(entry("band").state);
});

afterEach(() => {
  song.destroy();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Eight bars at 96 BPM, stopping short of the frame that lands on the loop. */
const ONE_PASS_MS = (32 * 60000) / 96 - 10;

/** Plays the Song for `ms` and runs each of its frames through the Band, in order. */
async function play(ms: number) {
  song.configure({ ...entry("song").state, running: true });
  vi.advanceTimersByTime(ms);
  const frames = songApp.next.mock.calls.slice(playedUpTo);
  playedUpTo = songApp.next.mock.calls.length;
  for (const [, frame] of frames) {
    now = frame.t;
    await band.process(frame);
  }
}

/** A frame at 96 BPM and 60 fps is 1.6/60 of a beat. */
const FRAME = 1.6 / 60 + 1e-9;

/** The beat each note or hit was meant for: the one it follows within a frame. */
function onBeat(t: number, beats: number[]) {
  return beats.find((b) => t >= b - 1e-9 && t - b < FRAME);
}

function times(part: string, sound?: string) {
  return played
    .filter((p) => p.part === part && (sound === undefined || p.sound === sound))
    .map((p) => p.t);
}

function expectOnBeats(ts: number[], beats: number[]) {
  expect(ts).toHaveLength(beats.length);
  ts.forEach((t, i) => expect(onBeat(t, [beats[i]])).toBe(beats[i]));
}

const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.round((to - from) / step) }, (_, i) => from + i * step);

const CHORDS = [
  ["A3", "C4", "E4", "G4"],
  ["F3", "A3", "C4", "E4"],
  ["G3", "C4", "E4", "G4"],
  ["G3", "B3", "D4", "G4"],
];

/** The root of each chord, which is what the bass plays under it. */
const ROOTS = ["A", "F", "C", "G"];

const pitchClass = (note: string) => note.replace(/-?\d+$/, "");

describe("the Pad Groove demo board", () => {
  it("is a tempo, a Song counting beats and a Band, with no picture", () => {
    expect(services.map((s) => s.uuid)).toEqual(["tempo", "song", "band"]);
    expect(entry("song").state).toMatchObject({
      clock: "own",
      unit: "beats",
      tempoSlot: "tempo",
      length: 32,
      loop: true,
    });
    expect(entry("band").state.tracks.map((t: any) => t.name)).toEqual([
      "pad",
      "bass",
      "hats",
      "kick",
      "snare",
      "fill",
    ]);
  });

  it("writes every part as a use of one of two blocks", () => {
    const doc = document as any;
    expect(doc.blocks.map((b: any) => b.id)).toEqual(["notes", "drum"]);
    const uses = doc.services.ui
      .find((s: any) => s.uuid === "band")
      .state.tracks.map((t: any) => t.pipeline[0].block);
    expect(uses).toEqual(["notes", "notes", "drum", "drum", "drum", "drum"]);
  });

  it("places every part's name, and nothing else", () => {
    const placed = new Set(entry("song").state.placements.map((p: any) => p.name));
    const taken = (document as any).services.ui
      .find((s: any) => s.uuid === "band")
      .state.tracks.map((t: any) => t.pipeline[0].params.name);
    expect(new Set(taken)).toEqual(placed);
  });

  it("plays the pad's four chords a bar each, twice through the song", async () => {
    await play(ONE_PASS_MS);
    const pad = played.filter((p) => p.part === "pad");
    const bars = range(0, 32, 4);
    expect(pad).toHaveLength(bars.length * 4);
    bars.forEach((bar, i) => {
      const chord = pad.slice(i * 4, i * 4 + 4);
      chord.forEach((note) => expect(onBeat(note.t, [bar])).toBe(bar));
      expect(chord.map((n) => n.sound)).toEqual(CHORDS[i % 4]);
    });
  });

  it("holds each chord for its bar, at whatever the tempo is", async () => {
    await play(1000);
    // Four beats at 96 BPM.
    expect(played.find((p) => p.part === "pad")!.seconds).toBeCloseTo(2.5);
    slots.set("tempo", 120);
    played = [];
    song.configure({ stop: true });
    await play(100);
    expect(played.find((p) => p.part === "pad")!.seconds).toBeCloseTo(2);
  });

  it("brings the bass in on the fifth bar, on the root of every chord", async () => {
    await play(ONE_PASS_MS);
    const bass = played.filter((p) => p.part === "bass");
    expect(Math.min(...bass.map((b) => b.t))).toBeGreaterThanOrEqual(16);
    expectOnBeats(
      bass.map((b) => b.t),
      range(16, 32, 4).flatMap((bar) => [bar, bar + 1.5, bar + 2.5, bar + 3.5]),
    );
    // The pad's chord in the bar each bass note falls in.
    for (const note of bass) {
      expect(pitchClass(note.sound)).toBe(ROOTS[Math.floor(note.t / 4) % 4]);
    }
  });

  it("brings the drums in bar by bar and ends on the fill", async () => {
    await play(ONE_PASS_MS);
    expectOnBeats(times("drums", "hihat"), range(8, 32, 0.5));
    expectOnBeats(times("drums", "kick"), range(16, 32, 4).flatMap((b) => [b, b + 2.5]));
    expectOnBeats(times("drums", "snare"), [25, 27, 29, 30, 30.5, 31, 31.25, 31.5, 31.75]);
  });

  it("plays the pad alone for the first two bars", async () => {
    await play(ONE_PASS_MS);
    expect(played.filter((p) => p.t < 8).every((p) => p.part === "pad")).toBe(true);
  });
});
