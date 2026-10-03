/**
 * Timeline service tests
 *
 * Covers:
 *  - Due-ness: each action fires once across consecutive frames, several at one
 *    moment in list order, loop wraps, the end of looping and non-looping
 *    timelines, the rest of a pass
 *  - Own clock: play, frame rate, pause and resume, stop, playing through to
 *    the end, looping, beats at the tempo slot, seek and its jump flag, bypass
 *  - Loop range: played into once, repeated, what lies past it silent, an own
 *    clock set past it taken to its start
 *  - Recording: input as an action happening now, passed through while
 *    stopped, kept at its exact moment while recording, overdub and replace
 *  - Placements: what an arranging timeline's frames say about each name, and
 *    how a placed timeline plays — stretched, looped, entered, jumped, scoped
 *  - Driven clock: the driver's time, null after the stretch, the frame that
 *    leaves the stretch, the driver starting over versus jumping, pass-through
 *    of the input's other fields, one timeline driving another
 *
 * All timing is controlled via Vitest fake timers — no real waits.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TimelineDescriptor from "../Timeline";
import {
  dueActions,
  loopRange,
  interpolate,
  normalizeKeyframes,
  normalizePlacements,
  placementsAt,
  restOfPass,
  valueAt,
  wrap,
} from "../timeline-core";
import { createSlotStore } from "../../../slots";

function createTimeline(slots = createSlotStore()) {
  const app = {
    notify: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
    slots: () => slots,
  };
  const timeline = TimelineDescriptor.create(
    app as any,
    "test-board",
    {} as any,
    "timeline-1",
  ) as any;
  return { timeline, app, slots };
}

/** Every frame the timeline emitted on its own, in order. */
function frames(app: { next: ReturnType<typeof vi.fn> }) {
  return app.next.mock.calls.map(([, frame]) => frame);
}

/** Every action data emitted, across all frames, in order. */
function fired(app: { next: ReturnType<typeof vi.fn> }) {
  return frames(app).flatMap((f) => f.actions);
}

const at = (pos: number, data: unknown) => ({ at: pos, data });

// ---------------------------------------------------------------------------
// Due-ness
// ---------------------------------------------------------------------------

describe("dueActions", () => {
  const open = { length: 0, loop: false };

  it("fires each action once across consecutive windows", () => {
    const actions = [at(0.1, "a"), at(0.2, "b"), at(0.3, "c")];
    const windows = [0, 0.15, 0.2, 0.25, 0.5];
    const seen = windows
      .slice(1)
      .flatMap((to, i) => dueActions(actions, windows[i], to, open));
    expect(seen).toEqual(["a", "b", "c"]);
  });

  it("counts the lower edge only when told to", () => {
    const actions = [at(1, "a")];
    expect(dueActions(actions, 1, 2, open)).toEqual([]);
    expect(dueActions(actions, 1, 2, open, true)).toEqual(["a"]);
  });

  it("fires several actions at one moment in list order, earliest first", () => {
    const actions = [at(2, "late"), at(1, "first"), at(1, "second")];
    expect(dueActions(actions, 0, 3, open)).toEqual(["first", "second", "late"]);
  });

  it("reports an action without data as null", () => {
    expect(dueActions([{ at: 1 }], 0, 1, open)).toEqual([null]);
  });

  it("fires the actions of every pass a looping window covers", () => {
    const loop = { length: 1, loop: true };
    const actions = [at(0, "start"), at(0.5, "mid")];
    expect(dueActions(actions, 0.75, 2.25, loop)).toEqual([
      "start",
      "mid",
      "start",
    ]);
  });

  it("never fires an action at the length of a looping timeline", () => {
    const loop = { length: 1, loop: true };
    expect(dueActions([at(1, "end")], 0, 3, loop)).toEqual([]);
  });

  it("fires an action at the length of a non-looping timeline, not beyond", () => {
    const bounded = { length: 1, loop: false };
    expect(dueActions([at(1, "end"), at(2, "past")], 0, 5, bounded)).toEqual([
      "end",
    ]);
  });

  it("finds the rest of the pass a position lies in", () => {
    const loop = { length: 2, loop: true };
    const actions = [at(0, "a"), at(1, "b"), at(1.5, "c"), at(2, "never")];
    expect(restOfPass(actions, 3.2, loop)).toEqual(["c"]);
    expect(restOfPass(actions, 0.5, { length: 2, loop: false })).toEqual([
      "b",
      "c",
      "never",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Keyframes
// ---------------------------------------------------------------------------

describe("keyframes", () => {
  const key = (pos: number, value: unknown, ease?: string) =>
    ({ at: pos, value, ...(ease ? { ease } : {}) }) as any;

  it("holds the first value before and the last after", () => {
    const frames = [key(1, 10), key(2, 20)];
    expect(valueAt(frames, 0)).toBe(10);
    expect(valueAt(frames, 5)).toBe(20);
  });

  it("travels linearly between keyframes unless eased", () => {
    const frames = [key(0, 0), key(2, 100)];
    expect(valueAt(frames, 0.5)).toBe(25);
    expect(valueAt([key(0, 0, "in"), key(2, 100)], 1)).toBeCloseTo(12.5);
    expect(valueAt([key(0, 0, "out"), key(2, 100)], 1)).toBeCloseTo(87.5);
    expect(valueAt([key(0, 0, "in-out"), key(2, 100)], 1)).toBeCloseTo(50);
  });

  it("holds a stepped value until the next keyframe", () => {
    const frames = [key(0, 0, "step"), key(2, 100)];
    expect(valueAt(frames, 1.99)).toBe(0);
    expect(valueAt(frames, 2)).toBe(100);
  });

  it("jumps where two keyframes share a moment", () => {
    const frames = normalizeKeyframes({ x: [key(1, 5), key(0, 0), key(1, 50)] }).x;
    expect(valueAt(frames, 0.5)).toBe(2.5);
    expect(valueAt(frames, 1)).toBe(50);
  });

  it("interpolates numbers with a shared suffix, and colours", () => {
    expect(interpolate("30%", "70%", 0.5)).toBe("50%");
    expect(interpolate("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("holds what it cannot interpolate", () => {
    expect(interpolate("30%", "70px", 0.5)).toBe("30%");
    expect(interpolate("sun.png", "moon.png", 0.9)).toBe("sun.png");
  });

  it("drops keyframes without a place, and properties without keyframes", () => {
    expect(
      normalizeKeyframes({ x: [{ value: 1 }, key(1, 2)], y: [], z: "no" }),
    ).toEqual({ x: [{ at: 1, value: 2 }] });
  });
});

// ---------------------------------------------------------------------------
// Own clock
// ---------------------------------------------------------------------------

describe("Timeline – own clock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("describes itself", () => {
    expect(TimelineDescriptor.serviceId).toBe("hookup.to/service/timeline");
    expect(TimelineDescriptor.serviceName).toBe("Timeline");
  });

  it("emits a frame as soon as it plays, with what sits at the start", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({ actions: [at(0, "go"), at(1, "later")], play: true });
    expect(frames(app)).toEqual([{ t: 0, actions: ["go"] }]);
  });

  it("emits fps frames a second, advancing in seconds", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({ fps: 10, play: true });
    vi.advanceTimersByTime(1000);
    const ts = frames(app).map((f) => f.t);
    expect(ts).toHaveLength(11);
    expect(ts.at(-1)).toBeCloseTo(1);
    timeline.destroy();
  });

  it("fires every action once while playing", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({
      fps: 30,
      actions: [at(0.25, "a"), at(0.5, "b"), at(0.5, "c")],
      play: true,
    });
    vi.advanceTimersByTime(1000);
    expect(fired(app)).toEqual(["a", "b", "c"]);
    timeline.destroy();
  });

  it("resumes after a pause without firing again what it fired", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({ fps: 10, actions: [at(0.2, "a"), at(0.6, "b")], play: true });
    vi.advanceTimersByTime(300);
    timeline.configure({ pause: true });
    vi.advanceTimersByTime(1000);
    const whilePaused = frames(app).length;
    vi.advanceTimersByTime(1000);
    expect(frames(app)).toHaveLength(whilePaused);

    timeline.configure({ play: true });
    vi.advanceTimersByTime(500);
    expect(fired(app)).toEqual(["a", "b"]);
    timeline.destroy();
  });

  it("stops back at the start, and plays what sits there again", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({ fps: 10, actions: [at(0, "start")], play: true });
    vi.advanceTimersByTime(300);
    timeline.configure({ stop: true });
    expect(timeline.state.running).toBe(false);
    timeline.configure({ play: true });
    expect(frames(app).at(-1)).toEqual({ t: 0, actions: ["start"] });
    expect(fired(app)).toEqual(["start", "start"]);
    timeline.destroy();
  });

  it("plays through to its end and halts there", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({ fps: 10, length: 1, actions: [at(1, "end")], play: true });
    vi.advanceTimersByTime(2000);
    expect(frames(app).at(-1)).toEqual({ t: 1, actions: ["end"] });
    expect(timeline.state.running).toBe(false);

    // Playing again is from the start.
    timeline.configure({ play: true });
    expect(frames(app).at(-1).t).toBe(0);
    timeline.destroy();
  });

  it("loops, firing its actions in every pass", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({
      fps: 20,
      length: 1,
      loop: true,
      actions: [at(0, "start"), at(0.5, "mid")],
      play: true,
    });
    vi.advanceTimersByTime(2600);
    expect(fired(app)).toEqual(["start", "mid", "start", "mid", "start", "mid"]);
    expect(frames(app).every((f) => f.t >= 0 && f.t < 1)).toBe(true);
    timeline.destroy();
  });

  it("counts beats at the tempo held in its slot", () => {
    const { timeline, app, slots } = createTimeline();
    slots.set("tempo", 60);
    timeline.configure({ fps: 10, unit: "beats", play: true });
    vi.advanceTimersByTime(1000);
    expect(frames(app).at(-1).t).toBeCloseTo(1);

    slots.set("tempo", 120);
    vi.advanceTimersByTime(1000);
    expect(frames(app).at(-1).t).toBeCloseTo(3);
    timeline.destroy();
  });

  it("puts the tempo it counted at on its frames, and only when counting beats", () => {
    const { timeline, app, slots } = createTimeline();
    slots.set("tempo", 90);
    timeline.configure({ fps: 10, unit: "beats", play: true });
    vi.advanceTimersByTime(200);
    expect(frames(app).at(-1).tempo).toBe(90);
    slots.set("tempo", 140);
    vi.advanceTimersByTime(100);
    expect(frames(app).at(-1).tempo).toBe(140);
    timeline.destroy();

    const seconds = createTimeline();
    seconds.timeline.configure({ fps: 10, play: true });
    vi.advanceTimersByTime(200);
    expect(frames(seconds.app).at(-1)).not.toHaveProperty("tempo");
    seconds.timeline.destroy();
  });

  it("counts beats at 120 BPM when no tempo is held", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({ fps: 10, unit: "beats", play: true });
    vi.advanceTimersByTime(1000);
    expect(frames(app).at(-1).t).toBeCloseTo(2);
    timeline.destroy();
  });

  it("seeks without firing what it skips, marking the frame as a jump", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({
      fps: 10,
      actions: [at(1, "skipped"), at(2, "there"), at(2.05, "after")],
      play: true,
    });
    timeline.configure({ seek: 2 });
    vi.advanceTimersByTime(100);
    const afterSeek = frames(app).at(-1);
    expect(afterSeek.jump).toBe(true);
    expect(afterSeek.actions).toEqual(["there", "after"]);
    vi.advanceTimersByTime(100);
    expect(frames(app).at(-1).jump).toBeUndefined();
    expect(fired(app)).not.toContain("skipped");
    timeline.destroy();
  });

  it("emits at once when sought while paused, so everything after it shows that moment", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({ actions: [at(1, "skipped"), at(2, "there")] });
    timeline.configure({ seek: 2 });
    expect(frames(app)).toEqual([{ t: 2, actions: ["there"], jump: true }]);

    // Playing on from there does not fire what sits there a second time.
    timeline.configure({ fps: 10, play: true });
    vi.advanceTimersByTime(300);
    expect(fired(app)).toEqual(["there"]);
    timeline.destroy();
  });

  it("shows an edit at once while paused, without firing anything", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({ actions: [at(1, "a")], object: { type: "rect" } });
    expect(frames(app)).toEqual([]); // nothing on show yet, nothing to update

    timeline.configure({ seek: 1 });
    timeline.configure({ keyframes: { x: [{ at: 0, value: 0 }, { at: 2, value: 20 }] } });
    expect(frames(app).at(-1)).toEqual({ type: "rect", x: 10, t: 1, actions: [] });
    expect(fired(app)).toEqual(["a"]);
  });

  it("keeps time but emits nothing while bypassed", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({ fps: 10, play: true });
    timeline.setBypass(true);
    const before = frames(app).length;
    vi.advanceTimersByTime(500);
    expect(frames(app)).toHaveLength(before);
    timeline.setBypass(false);
    vi.advanceTimersByTime(100);
    expect(frames(app).at(-1).t).toBeCloseTo(0.6);
    timeline.destroy();
  });

  it("does not play when driven", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({ clock: "input", play: true });
    expect(frames(app)).toEqual([]);
    expect(timeline.state.running).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Loop range
// ---------------------------------------------------------------------------

describe("loop range", () => {
  const range = { length: 0, loop: true, loopStart: 1, loopEnd: 2 };

  it("is the whole length by default, and nothing when not looping or empty", () => {
    expect(loopRange({ length: 4, loop: true })).toEqual({ start: 0, end: 4 });
    expect(loopRange({ length: 4, loop: false, loopStart: 1, loopEnd: 2 })).toBeNull();
    expect(loopRange({ length: 0, loop: true })).toBeNull();
    expect(loopRange({ length: 4, loop: true, loopStart: 3, loopEnd: 2 })).toBeNull();
    expect(loopRange({ length: 3, loop: true, loopStart: 1, loopEnd: 8 })).toEqual({ start: 1, end: 3 });
  });

  it("plays what lies before it once, repeats what lies in it, and never what lies past it", () => {
    const actions = [at(0.5, "intro"), at(1.5, "in"), at(2.5, "past")];
    expect(dueActions(actions, 0, 4.9, range, true)).toEqual(["intro", "in", "in", "in", "in"]);
  });

  it("wraps into the range only past its end", () => {
    expect(wrap(0.5, range)).toBe(0.5);
    expect(wrap(1.5, range)).toBe(1.5);
    expect(wrap(2.25, range)).toBe(1.25);
    expect(wrap(3.75, range)).toBe(1.75);
  });

  it("finds the rest of a pass up to the range's end", () => {
    const actions = [at(1.25, "a"), at(1.75, "b"), at(2.5, "past")];
    expect(restOfPass(actions, 2.5, range)).toEqual(["b"]);
  });
});

describe("Timeline – loop range", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays into its range and repeats it", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({
      fps: 10,
      loop: true,
      loopStart: 1,
      loopEnd: 2,
      actions: [at(0.5, "intro"), at(1, "start"), at(1.5, "in"), at(2.5, "past")],
      play: true,
    });
    vi.advanceTimersByTime(3500);
    expect(fired(app)).toEqual(["intro", "start", "in", "start", "in", "start", "in"]);
    const ts = frames(app).map((f) => f.t);
    expect(Math.max(...ts)).toBeLessThan(2);
    timeline.destroy();
  });

  it("takes a seek past its end to its start", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({ loop: true, loopStart: 1, loopEnd: 2, actions: [at(1, "start")] });
    timeline.configure({ seek: 3 });
    expect(frames(app).at(-1)).toEqual({ t: 1, actions: ["start"], jump: true });
  });

  it("goes to its start when the range moves to before where the timeline stands", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({ fps: 10, actions: [at(0.5, "a")], play: true });
    vi.advanceTimersByTime(3000);
    timeline.configure({ loop: true, loopStart: 0.5, loopEnd: 1 });
    vi.advanceTimersByTime(100);
    expect(frames(app).at(-1).t).toBeCloseTo(0.6);
    expect(fired(app)).toEqual(["a", "a"]);
    timeline.destroy();
  });

  it("plays everything again when it stops looping", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({
      fps: 10,
      loop: false,
      loopStart: 1,
      loopEnd: 2,
      actions: [at(1.5, "in"), at(2.5, "past")],
      play: true,
    });
    vi.advanceTimersByTime(3000);
    expect(fired(app)).toEqual(["in", "past"]);
    timeline.destroy();
  });

  it("records into its range, overdubbing pass after pass", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({ fps: 10, loop: true, loopStart: 1, loopEnd: 2, recording: true, play: true });
    vi.advanceTimersByTime(2250);
    timeline.process("hit");
    expect(timeline.state.actions.map((a: any) => Math.round(a.at * 100) / 100)).toEqual([1.25]);
    vi.advanceTimersByTime(1050);
    expect(fired(app)).toEqual(["hit"]);
    timeline.destroy();
  });
});

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

describe("Timeline – recording", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Where the actions sit, rounded against the clock's float arithmetic. */
  const placed = (timeline: any) =>
    timeline.state.actions.map((a: any) => [Math.round(a.at * 1000) / 1000, a.data]);

  it("passes input through while stopped, on a frame for where it stands", () => {
    const { timeline } = createTimeline();
    timeline.configure({ recording: true });
    expect(timeline.process("hit")).toEqual({ t: 0, actions: ["hit"] });
    expect(timeline.state.actions).toEqual([]);
  });

  it("emits nothing for no input", () => {
    const { timeline } = createTimeline();
    expect(timeline.process(undefined)).toBeNull();
    expect(timeline.process(null)).toBeNull();
  });

  it("takes the clock to the moment an input arrives, not the last frame's", () => {
    const { timeline } = createTimeline();
    timeline.configure({ fps: 10, play: true });
    vi.advanceTimersByTime(250);
    const frame = timeline.process("hit");
    expect(frame.t).toBeCloseTo(0.25);
    expect(frame.actions).toEqual(["hit"]);
    expect(timeline.state.actions).toEqual([]);
    timeline.destroy();
  });

  it("keeps what arrives while recording at the moment it arrived, and plays it back there", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({ fps: 10, recording: true, play: true });
    vi.advanceTimersByTime(250);
    timeline.process("a");
    vi.advanceTimersByTime(300);
    timeline.process("b");
    // What was just recorded is not due again in the frames that follow.
    vi.advanceTimersByTime(300);
    expect(fired(app)).toEqual([]);

    timeline.configure({ stop: true });
    expect(placed(timeline)).toEqual([[0.25, "a"], [0.55, "b"]]);

    app.next.mockClear();
    timeline.configure({ play: true });
    vi.advanceTimersByTime(1000);
    const firing = frames(app).filter((f) => f.actions.length > 0);
    expect(firing.map((f) => f.actions)).toEqual([["a"], ["b"]]);
    expect(firing[0].t).toBeGreaterThanOrEqual(0.25);
    expect(firing[0].t).toBeLessThan(0.35);
    timeline.destroy();
  });

  it("records in the timeline's time, so a playback speed applies to it", () => {
    const { timeline } = createTimeline();
    timeline.configure({ fps: 10, speed: 2, recording: true, play: true });
    vi.advanceTimersByTime(250);
    timeline.process("a");
    expect(placed(timeline)).toEqual([[0.5, "a"]]);
    timeline.destroy();
  });

  it("records nothing while stopped", () => {
    const { timeline } = createTimeline();
    timeline.configure({ recording: true });
    timeline.process("a");
    expect(timeline.state.actions).toEqual([]);
  });

  it("overdubs on a loop: what was there stays, and what was added plays on the next pass", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({
      fps: 10,
      length: 1,
      loop: true,
      actions: [at(0.5, "old")],
      recording: true,
      play: true,
    });
    vi.advanceTimersByTime(250);
    timeline.process("new");
    vi.advanceTimersByTime(1100);
    expect(fired(app)).toEqual(["old", "new"]);
    expect(placed(timeline)).toEqual([[0.25, "new"], [0.5, "old"]]);
    timeline.destroy();
  });

  it("replaces what it passes over while recording, and nothing it has not reached", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({
      fps: 10,
      actions: [at(0, "start"), at(0.2, "early"), at(0.8, "late")],
      recordMode: "replace",
      recording: true,
      play: true,
    });
    vi.advanceTimersByTime(500);
    timeline.process("new");
    timeline.configure({ stop: true });
    expect(fired(app)).toEqual([]);
    expect(placed(timeline)).toEqual([[0.5, "new"], [0.8, "late"]]);
    expect(app.notify).toHaveBeenCalledWith(timeline, { actions: timeline.state.actions });
  });

  it("replaces a loop pass by pass", () => {
    const { timeline } = createTimeline();
    timeline.configure({ fps: 10, length: 1, loop: true, recordMode: "replace", recording: true, play: true });
    vi.advanceTimersByTime(250);
    timeline.process("first pass");
    vi.advanceTimersByTime(1100);
    timeline.process("second pass");
    expect(placed(timeline)).toEqual([[0.35, "second pass"]]);
    timeline.destroy();
  });

  it("ends a recording when it stops or pauses", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({ fps: 10, recording: true, play: true });
    timeline.configure({ pause: true });
    expect(timeline.state.recording).toBe(false);
    expect(app.notify).toHaveBeenCalledWith(timeline, { recording: false });

    timeline.configure({ recording: true, play: true });
    timeline.configure({ stop: true });
    expect(timeline.state.recording).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Driven clock
// ---------------------------------------------------------------------------

describe("Timeline – driven", () => {
  function driven(config: Record<string, unknown>) {
    const { timeline, app } = createTimeline();
    timeline.configure({ clock: "input", ...config });
    return { timeline, app };
  }

  it("counts in its driver's time", () => {
    const { timeline } = driven({});
    expect(timeline.process({ t: 3 })).toEqual({ t: 3, actions: [] });
  });

  it("accepts a bare number as time", () => {
    const { timeline } = driven({});
    expect(timeline.process(1.5)).toEqual({ t: 1.5, actions: [] });
  });

  it("delivers what falls due on the way out, then emits null", () => {
    const { timeline } = driven({ length: 1, actions: [at(1, "end")] });
    timeline.process({ t: 0.9 });
    expect(timeline.process({ t: 1.1 })).toEqual({ t: 1, actions: ["end"] });
    expect(timeline.process({ t: 1.2 })).toBeNull();
  });

  it("loops within its driver's time", () => {
    const { timeline } = driven({ length: 1, loop: true, actions: [at(0.5, "mid")] });
    timeline.process({ t: 0 });
    const frame = timeline.process({ t: 1.75 });
    expect(frame.t).toBeCloseTo(0.75);
    expect(frame.actions).toEqual(["mid", "mid"]);
  });

  it("takes time going back as its driver starting over", () => {
    const { timeline } = driven({
      length: 2,
      loop: true,
      actions: [at(0, "start"), at(1.9, "tail")],
    });
    timeline.process({ t: 0 });
    timeline.process({ t: 1.8 });
    expect(timeline.process({ t: 0.1 }).actions).toEqual(["tail", "start"]);
  });

  it("fires only what sits exactly there after a jump", () => {
    const { timeline } = driven({ actions: [at(0, "start"), at(2, "there")] });
    timeline.process({ t: 3 });
    expect(timeline.process({ t: 1, jump: true }).actions).toEqual([]);
    expect(timeline.process({ t: 2, jump: true }).actions).toEqual(["there"]);
  });

  it("keeps the other fields of its input, jump included", () => {
    const { timeline } = driven({ actions: [at(0, "inner")] });
    expect(
      timeline.process({ t: 0, actions: ["outer"], color: "red", jump: true }),
    ).toEqual({ t: 0, actions: ["inner"], color: "red", jump: true });
  });

  it("shows an edit on the frame it last emitted", () => {
    const { timeline, app } = driven({ object: { type: "rect" }, length: 1 });
    timeline.configure({ keyframes: { x: [{ at: 0, value: 5 }] } });
    expect(frames(app)).toEqual([]); // no frame yet

    timeline.process({ t: 0.5, color: "ignored" });
    timeline.configure({ keyframes: { x: [{ at: 0, value: 7 }] } });
    expect(frames(app)).toEqual([{ type: "rect", x: 7, t: 0.5, actions: [] }]);

    timeline.process({ t: 1.5 }); // past its stretch: nothing on show
    timeline.configure({ keyframes: {} });
    expect(frames(app)).toHaveLength(1);
  });

  it("emits null for input without a time", () => {
    const { timeline } = driven({});
    expect(timeline.process({ nothing: true })).toBeNull();
  });
});

describe("Timeline – an animated object", () => {
  it("passes its driver's tempo on, since it counts in its driver's beats", () => {
    const { timeline } = createTimeline();
    timeline.configure({ clock: "input", object: { type: "rect" } });
    expect(timeline.process({ t: 1, tempo: 96 })).toMatchObject({ type: "rect", tempo: 96 });
    expect(timeline.process({ t: 1.5 })).not.toHaveProperty("tempo");
  });

  const image = { type: "image", url: "star.svg", height: "20%" };
  const keyframes = {
    rotate: [
      { at: 0, value: 0 },
      { at: 2, value: 360 },
    ],
    centerX: [
      { at: 0, value: "10%" },
      { at: 2, value: "90%" },
    ],
  };

  it("emits its object with each keyframed property at its value", () => {
    const { timeline } = createTimeline();
    timeline.configure({ clock: "input", object: image, keyframes });
    expect(timeline.process({ t: 1 })).toEqual({
      ...image,
      rotate: 180,
      centerX: "50%",
      t: 1,
      actions: [],
    });
  });

  it("does not take on the fields of the frame driving it", () => {
    const { timeline } = createTimeline();
    timeline.configure({ clock: "input", object: image });
    const frame = timeline.process({ t: 0, type: "group", x: 5, jump: true });
    expect(frame).toEqual({ ...image, t: 0, actions: [], jump: true });
  });

  it("animates on its own clock too", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { timeline, app } = createTimeline();
    timeline.configure({ fps: 10, object: image, keyframes, play: true });
    vi.advanceTimersByTime(500);
    const frame = frames(app).at(-1);
    expect(frame.rotate).toBeCloseTo(90);
    expect(frame.url).toBe("star.svg");
    timeline.destroy();
    vi.useRealTimers();
  });

  it("is drawn only while its placement plays", () => {
    const { timeline } = createTimeline();
    timeline.configure({ clock: "input", object: image, length: 2, placement: "a" });
    expect(timeline.process({ t: 0.5, placements: { a: null } })).toBeNull();
    expect(
      timeline.process({ t: 2, placements: { a: { progress: 0.5, elapsed: 1 } } }),
    ).toMatchObject({ type: "image", t: 1 });
    expect(timeline.process({ t: 3.5, placements: { a: null } })).toBeNull();
  });
});

describe("Timeline – one driving another", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts the inner timeline over each time the outer one loops", () => {
    const outer = createTimeline();
    const inner = createTimeline();
    inner.timeline.configure({
      clock: "input",
      placement: "blink",
      length: 0.25,
      actions: [at(0, "on"), at(0.25, "off")],
    });
    const innerOut: any[] = [];
    outer.app.next.mockImplementation((_svc: unknown, frame: unknown) => {
      innerOut.push(inner.timeline.process(frame));
    });

    outer.timeline.configure({
      fps: 20,
      length: 1,
      loop: true,
      placements: [{ name: "blink", at: 0.5, duration: 0.25 }],
      play: true,
    });
    vi.advanceTimersByTime(2000);

    const innerFired = innerOut.filter(Boolean).flatMap((f) => f.actions);
    expect(innerFired).toEqual(["on", "off", "on", "off"]);
    outer.timeline.destroy();
  });
});

// ---------------------------------------------------------------------------
// Placements
// ---------------------------------------------------------------------------

describe("placementsAt", () => {
  const open = { length: 0, loop: false };
  const placements = normalizePlacements([
    { name: "b", at: 2, duration: 1 },
    { name: "a", at: 0, duration: 2 },
    { name: "a", at: 1.5, duration: 1 },
    { name: "", at: 0, duration: 1 },
    { name: "c", at: 0, duration: 0 },
  ]);

  it("keeps placements with a name, a place and a duration, in the order they start", () => {
    expect(placements.map((p) => `${p.name}@${p.at}`)).toEqual(["a@0", "a@1.5", "b@2"]);
  });

  it("says how far into its placement each name is, and null for those not playing", () => {
    expect(placementsAt(placements, 1, open)).toEqual({
      a: { progress: 0.5, elapsed: 1 },
      b: null,
    });
  });

  it("lets the later of two overlapping placements of a name win", () => {
    expect(placementsAt(placements, 1.75, open).a).toEqual({ progress: 0.25, elapsed: 0.25 });
  });

  it("reports a placement that ended in the frame at its end", () => {
    const ended = [2]; // b's index
    expect(placementsAt(placements, 3.5, open, ended).b).toEqual({ progress: 1, elapsed: 1 });
    expect(placementsAt(placements, 3.5, open).b).toBeNull();
  });

  it("cuts a placement at the length of a bounded timeline", () => {
    const cut = normalizePlacements([{ name: "a", at: 3, duration: 2 }]);
    expect(placementsAt(cut, 4.5, { length: 4, loop: false }).a).toBeNull();
    expect(placementsAt(cut, 4, { length: 4, loop: false }).a).toEqual({
      progress: 0.5,
      elapsed: 1,
    });
  });
});

describe("Timeline – arranging by placements", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("carries every name it places in each frame it emits", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({
      fps: 10,
      placements: [
        { name: "a", at: 0, duration: 0.5 },
        { name: "b", at: 1, duration: 1 },
      ],
      play: true,
    });
    expect(frames(app)[0].placements).toEqual({
      a: { progress: 0, elapsed: 0 },
      b: null,
    });
    vi.advanceTimersByTime(1500);
    expect(frames(app).at(-1).placements.a).toBeNull();
    expect(frames(app).at(-1).placements.b.progress).toBeCloseTo(0.5);
    timeline.destroy();
  });

  it("does not skip the end of a placement that ends between two frames", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({
      fps: 10,
      placements: [{ name: "a", at: 0, duration: 0.25 }],
      play: true,
    });
    vi.advanceTimersByTime(500);
    const progress = frames(app)
      .map((f) => f.placements.a?.progress)
      .filter((p) => p !== undefined);
    expect(progress).toEqual([0, 0.4, 0.8, 1]);
    timeline.destroy();
  });

  it("reports the end of a placement it leaves its stretch by, then emits null", () => {
    const { timeline } = createTimeline();
    timeline.configure({
      clock: "input",
      length: 1,
      placements: [{ name: "a", at: 0.5, duration: 0.5 }],
    });
    timeline.process({ t: 0.9 });
    const frame = timeline.process({ t: 1.1 });
    expect(frame.t).toBe(1);
    expect(frame.actions).toEqual([]);
    expect(frame.placements.a).toEqual({ progress: 1, elapsed: 0.5 });
    expect(timeline.process({ t: 1.2 })).toBeNull();
  });
});

describe("Timeline – placed", () => {
  function placed(config: Record<string, unknown>) {
    const { timeline, app } = createTimeline();
    timeline.configure({ clock: "input", placement: "a", ...config });
    return { timeline, app };
  }
  const playing = (progress: number, elapsed: number, more: object = {}) => ({
    t: 0,
    placements: { a: { progress, elapsed } },
    ...more,
  });

  it("is stretched to its placement when it does not loop", () => {
    const { timeline } = placed({ length: 4 });
    expect(timeline.process(playing(0.25, 0.5)).t).toBe(1);
  });

  it("plays at its own speed when it loops, repeating while the placement lasts", () => {
    const { timeline } = placed({ length: 0.5, loop: true, actions: [at(0, "pass")] });
    timeline.process(playing(0, 0));
    const frame = timeline.process(playing(0.5, 1.2));
    expect(frame.t).toBeCloseTo(0.2);
    expect(frame.actions).toEqual(["pass", "pass"]);
  });

  it("plays at its own speed when unbounded", () => {
    const { timeline } = placed({});
    expect(timeline.process(playing(0.9, 3)).t).toBe(3);
  });

  it("enters from its start when its name starts playing", () => {
    const { timeline } = placed({ length: 4, actions: [at(0, "start"), at(0.5, "soon")] });
    expect(timeline.process({ t: 0, placements: { a: null } })).toBeNull();
    expect(timeline.process(playing(0.25, 0.25)).actions).toEqual(["start", "soon"]);
  });

  it("fires only what sits exactly there when its driver jumped into it", () => {
    const { timeline } = placed({ length: 4, actions: [at(0, "start"), at(1, "there")] });
    expect(timeline.process(playing(0.25, 0.25, { jump: true })).actions).toEqual(["there"]);
  });

  it("starts over when the same name is placed again right after", () => {
    const { timeline } = placed({ length: 1, actions: [at(0, "start"), at(1, "end")] });
    timeline.process(playing(0, 0));
    timeline.process(playing(0.9, 0.9));
    expect(timeline.process(playing(0.1, 0.1)).actions).toEqual(["end", "start"]);
  });

  it("says whether its driver's frames place it", () => {
    const { timeline, app } = placed({ length: 1 });
    const status = () =>
      app.notify.mock.calls.map(([, n]) => n.placementStatus).filter(Boolean).at(-1);
    timeline.process({ t: 0 });
    expect(status()).toBe("no-placements");
    timeline.process({ t: 0, placements: { b: null } });
    expect(status()).toBe("unplaced");
    timeline.process({ t: 0, placements: { a: null } });
    expect(status()).toBe("waiting");
    timeline.process(playing(0, 0));
    expect(status()).toBe("playing");
  });

  it("passes on its own placements, not its driver's", () => {
    const night = createTimeline().timeline;
    night.configure({
      clock: "input",
      placement: "night",
      length: 4,
      placements: [{ name: "twinkle", at: 1, duration: 2 }],
    });
    const frame = night.process({
      t: 5,
      placements: { night: { progress: 0.5, elapsed: 2 }, twinkle: null },
    });
    expect(frame.placements).toEqual({ twinkle: { progress: 0.5, elapsed: 1 } });

    const plain = createTimeline().timeline;
    plain.configure({ clock: "input" });
    expect(plain.process({ t: 1, placements: { x: null } }).placements).toEqual({});
  });
});
