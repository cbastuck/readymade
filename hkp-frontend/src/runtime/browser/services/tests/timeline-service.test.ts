/**
 * Timeline service tests
 *
 * Covers:
 *  - Due-ness: each action fires once across consecutive frames, several at one
 *    moment in list order, loop wraps, the end of looping and non-looping
 *    timelines, the rest of a pass
 *  - Own clock: play, frame rate, pause and resume, stop, playing through to
 *    the end, looping, beats at the tempo slot, seek and its jump flag, bypass
 *  - Driven clock: offset and speed, null outside the stretch, the frame that
 *    leaves the stretch, the driver starting over versus jumping, pass-through
 *    of the input's other fields, one timeline driving another
 *
 * All timing is controlled via Vitest fake timers — no real waits.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TimelineDescriptor from "../Timeline";
import {
  dueActions,
  interpolate,
  normalizeKeyframes,
  restOfPass,
  valueAt,
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

  it("ignores input", () => {
    const { timeline } = createTimeline();
    expect(timeline.process({ t: 3 })).toBeNull();
  });

  it("does not play when driven", () => {
    const { timeline, app } = createTimeline();
    timeline.configure({ clock: "input", play: true });
    expect(frames(app)).toEqual([]);
    expect(timeline.state.running).toBe(false);
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

  it("counts its own time from the offset, at its speed", () => {
    const { timeline } = driven({ offset: 2, speed: 2 });
    expect(timeline.process({ t: 3 })).toEqual({ t: 2, actions: [] });
  });

  it("accepts a bare number as time", () => {
    const { timeline } = driven({});
    expect(timeline.process(1.5)).toEqual({ t: 1.5, actions: [] });
  });

  it("emits null before its stretch, and its start once it enters", () => {
    const { timeline } = driven({ offset: 1, actions: [at(0, "enter")] });
    expect(timeline.process({ t: 0.9 })).toBeNull();
    const entered = timeline.process({ t: 1.05 });
    expect(entered.actions).toEqual(["enter"]);
    expect(entered.t).toBeCloseTo(0.05);
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

  it("owes nothing from before its stretch when its driver starts over", () => {
    const { timeline } = driven({ offset: 1, actions: [at(0.5, "a")] });
    timeline.process({ t: 0.5 });
    expect(timeline.process({ t: 0.2 })).toBeNull();
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
    const { timeline, app } = driven({ object: { type: "rect" }, offset: 1 });
    timeline.configure({ keyframes: { x: [{ at: 0, value: 5 }] } });
    expect(frames(app)).toEqual([]); // no frame yet

    timeline.process({ t: 1.5, color: "ignored" });
    timeline.configure({ keyframes: { x: [{ at: 0, value: 7 }] } });
    expect(frames(app)).toEqual([{ type: "rect", x: 7, t: 0.5, actions: [] }]);

    timeline.process({ t: 0.5 }); // before its stretch again: nothing on show
    timeline.configure({ keyframes: {} });
    expect(frames(app)).toHaveLength(1);
  });

  it("emits null for input without a time", () => {
    const { timeline } = driven({});
    expect(timeline.process({ nothing: true })).toBeNull();
  });
});

describe("Timeline – an animated object", () => {
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

  it("is drawn only within its stretch", () => {
    const { timeline } = createTimeline();
    timeline.configure({ clock: "input", object: image, offset: 1, length: 2 });
    expect(timeline.process({ t: 0.5 })).toBeNull();
    expect(timeline.process({ t: 2 })).toMatchObject({ type: "image", t: 1 });
    expect(timeline.process({ t: 3.5 })).toBeNull();
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
      offset: 0.5,
      length: 0.25,
      actions: [at(0, "on"), at(0.25, "off")],
    });
    const innerOut: any[] = [];
    outer.app.next.mockImplementation((_svc: unknown, frame: unknown) => {
      innerOut.push(inner.timeline.process(frame));
    });

    outer.timeline.configure({ fps: 20, length: 1, loop: true, play: true });
    vi.advanceTimersByTime(2000);

    const innerFired = innerOut.filter(Boolean).flatMap((f) => f.actions);
    expect(innerFired).toEqual(["on", "off", "on", "off"]);
    outer.timeline.destroy();
  });
});
