import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TimelineDescriptor from "../Timeline";
import FilterDescriptor from "../Filter";
import MapDescriptor from "../Map";
import board from "../../../../../../boards/triggerpad-recorder-board.json";

/**
 * The Trigger Pad Recorder board: what the pad emits reaches the Recorder, a
 * timeline, and leaves it through On a hit and The hit towards the speaker.
 * Pad hits are stood in for by Blobs, and each frame is run through the board's
 * own Filter and Map — so what is checked is what Audio Output would be given.
 */

const entry = (uuid: string) =>
  structuredClone(board.services.ui.find((s) => s.uuid === uuid)) as any;

function makeApp() {
  return {
    notify: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
    getRuntimeVariable: vi.fn(() => ({})),
    setRuntimeVariable: vi.fn(),
  } as any;
}

let recorder: any;
let recorderApp: any;
let filter: any;
let map: any;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  recorderApp = makeApp();
  recorder = TimelineDescriptor.create(recorderApp, "board", {} as any, "recorder");
  recorder.configure(entry("recorder").state);
  filter = FilterDescriptor.create(makeApp(), "board", {} as any, "on-a-hit");
  filter.configure(entry("on-a-hit").state);
  map = MapDescriptor.create(makeApp(), "board", {} as any, "the-hit");
  map.configure(entry("the-hit").state);
});

afterEach(() => {
  recorder.destroy();
  vi.useRealTimers();
});

/** What reaches the speaker for one frame, or null where nothing does. */
async function toSpeaker(frame: any) {
  const passed = await filter.process(frame);
  return passed === null || passed === undefined ? null : await map.process(passed);
}

const hit = (name: string) => new Blob([name], { type: "audio/webm" });

describe("Trigger Pad Recorder board", () => {
  it("sends a hit straight to the speaker while the recorder is stopped", async () => {
    const kick = hit("kick");
    expect(await toSpeaker(recorder.process(kick))).toBe(kick);
    expect(recorder.state.actions).toEqual([]);
  });

  it("sends nothing to the speaker for a frame without a hit", async () => {
    recorder.configure({ play: true });
    vi.advanceTimersByTime(100);
    const frames = recorderApp.next.mock.calls.map(([, f]: any) => f);
    const heard = await Promise.all(frames.map(toSpeaker));
    expect(heard.every((h: unknown) => h === null)).toBe(true);
  });

  it("plays a take back at the moments it was played", async () => {
    const kick = hit("kick");
    const snare = hit("snare");

    recorder.configure({ recording: true, play: true });
    vi.advanceTimersByTime(500);
    expect(await toSpeaker(recorder.process(kick))).toBe(kick);
    vi.advanceTimersByTime(250);
    expect(await toSpeaker(recorder.process(snare))).toBe(snare);
    recorder.configure({ stop: true });

    recorderApp.next.mockClear();
    recorder.configure({ play: true });
    vi.advanceTimersByTime(1000);
    const heard: { t: number; sound: unknown }[] = [];
    for (const [, frame] of recorderApp.next.mock.calls) {
      const sound = await toSpeaker(frame);
      if (sound) {
        heard.push({ t: frame.t, sound });
      }
    }
    expect(heard.map((h) => h.sound)).toEqual([kick, snare]);
    // At most a frame (1/60 s) after the moment each was played.
    expect(heard[0].t - 0.5).toBeGreaterThanOrEqual(0);
    expect(heard[0].t - 0.5).toBeLessThan(1 / 60 + 1e-9);
    expect(heard[1].t - 0.75).toBeLessThan(1 / 60 + 1e-9);
  });
});
