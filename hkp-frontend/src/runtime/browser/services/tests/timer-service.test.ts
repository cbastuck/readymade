/**
 * Timer service tests
 *
 * Covers:
 *  - Default state and descriptor shape
 *  - configure(): setting periodicValue, periodicUnit, periodic flag, oneShotDelay,
 *    oneShotDelayUnit, counter, until condition
 *  - Commands: start, stop, restart, immediate flag
 *  - Periodic mode: fires at the correct interval, respects unit conversions,
 *    restarts silently when value/unit changes while already running
 *  - One-shot mode via configure(start) and via process()
 *  - process(): passthrough for periodic, delay then fire for one-shot,
 *    dropped if already sleeping
 *  - until condition: auto-stops after triggerCount is exceeded
 *  - notify contract: running, counter, periodicValue, periodicUnit, oneShotDelay
 *  - destroy(): clears timer
 *  - nextTimerArgument() increments counter
 *
 * All timing is controlled via Vitest fake timers — no real waits.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import TimerDescriptor from "../base/Timer";

const TimerService = TimerDescriptor.service;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockApp() {
  return {
    notify: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
  };
}

function createTimer() {
  const app = createMockApp();
  const timer = new TimerService(app, "test-board", {}, "timer-1");
  return { timer, app };
}

// ---------------------------------------------------------------------------
// Descriptor shape
// ---------------------------------------------------------------------------

describe("Timer descriptor", () => {
  it("exports serviceName and serviceId", () => {
    expect(TimerDescriptor.serviceName).toBe("Timer");
    expect(TimerDescriptor.serviceId).toBe("hookup.to/service/timer");
  });

  it("exports a constructable Timer class", () => {
    const { timer } = createTimer();
    expect(timer).toBeDefined();
    expect(typeof timer.configure).toBe("function");
    expect(typeof timer.process).toBe("function");
    expect(typeof timer.destroy).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

describe("Timer service – default state", () => {
  it("starts not running", () => {
    const { timer } = createTimer();
    expect(timer.running).toBe(false);
  });

  it("starts with periodic false", () => {
    const { timer } = createTimer();
    expect(timer.periodic).toBe(false);
  });

  it("starts with periodicValue = 1 and unit = 's'", () => {
    const { timer } = createTimer();
    expect(timer.periodicValue).toBe(1);
    expect(timer.periodicUnit).toBe("s");
  });

  it("starts with oneShotDelay = 0 and unit = 'ms'", () => {
    const { timer } = createTimer();
    expect(timer.oneShotDelay).toBe(0);
    expect(timer.oneShotDelayUnit).toBe("ms");
  });

  it("starts with counter = 0", () => {
    const { timer } = createTimer();
    expect(timer.counter).toBe(0);
  });

  it("getConfiguration returns full timer UI state", async () => {
    const { timer } = createTimer();
    const cfg = await timer.getConfiguration();

    expect(cfg).toMatchObject({
      periodic: false,
      periodicValue: 1,
      periodicUnit: "s",
      oneShotDelay: 0,
      oneShotDelayUnit: "ms",
      running: false,
      counter: 0,
      bypass: false,
    });
  });
});

// ---------------------------------------------------------------------------
// configure() – property updates (no start/stop)
// ---------------------------------------------------------------------------

describe("Timer service – configure() property updates", () => {
  it("sets periodicValue and notifies", () => {
    const { timer, app } = createTimer();
    timer.configure({ periodicValue: 5 });
    expect(timer.periodicValue).toBe(5);
    expect(app.notify).toHaveBeenCalledWith(timer, { periodicValue: 5 });
  });

  it("sets periodicUnit and notifies", () => {
    const { timer, app } = createTimer();
    timer.configure({ periodicUnit: "ms" });
    expect(timer.periodicUnit).toBe("ms");
    expect(app.notify).toHaveBeenCalledWith(timer, { periodicUnit: "ms" });
  });

  it("sets periodic flag and notifies", () => {
    const { timer, app } = createTimer();
    timer.configure({ periodic: true });
    expect(timer.periodic).toBe(true);
    expect(app.notify).toHaveBeenCalledWith(timer, { periodic: true });
  });

  it("sets oneShotDelay and notifies with periodic: false", () => {
    const { timer, app } = createTimer();
    timer.configure({ oneShotDelay: 500 });
    expect(timer.oneShotDelay).toBe(500);
    expect(app.notify).toHaveBeenCalledWith(timer, {
      oneShotDelay: 500,
      periodic: false,
    });
  });

  it("sets oneShotDelayUnit and notifies", () => {
    const { timer, app } = createTimer();
    timer.configure({ oneShotDelayUnit: "s" });
    expect(timer.oneShotDelayUnit).toBe("s");
    expect(app.notify).toHaveBeenCalledWith(timer, { oneShotDelayUnit: "s" });
  });

  it("sets counter directly", () => {
    const { timer } = createTimer();
    timer.configure({ counter: 42 });
    expect(timer.counter).toBe(42);
  });

  it("sets until triggerCount condition", () => {
    const { timer } = createTimer();
    timer.configure({ until: { triggerCount: 5 } });
    expect(timer.conditionUntilTriggercount).toBe(5);
  });

  it("notifies running: false when stopped", () => {
    const { timer, app } = createTimer();
    timer.configure({ periodicValue: 1 });
    // last call in configure() is always running notification
    const lastCall = app.notify.mock.calls.at(-1);
    expect(lastCall).toEqual([timer, { running: false }]);
  });
});

// ---------------------------------------------------------------------------
// configure() – stop command
// ---------------------------------------------------------------------------

describe("Timer service – stop command", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stop clears a running periodic timer", () => {
    const { timer, app } = createTimer();
    timer.configure({
      periodic: true,
      periodicValue: 100,
      periodicUnit: "ms",
      start: true,
    });
    expect(timer.running).toBe(true);

    app.notify.mockClear();
    timer.configure({ stop: true });
    expect(timer.running).toBe(false);
    expect(app.notify).toHaveBeenCalledWith(timer, {
      running: false,
      count: 0,
    });
  });

  it("stop on an already-stopped timer is a no-op", () => {
    const { timer, app } = createTimer();
    app.notify.mockClear();
    timer.configure({ stop: true });
    // clearTimer only notifies when __timer is set; it wasn't
    expect(app.notify).toHaveBeenCalledWith(timer, { running: false });
    expect(timer.running).toBe(false);
  });

  it("running: false triggers stop", () => {
    const { timer } = createTimer();
    timer.configure({
      periodic: true,
      periodicValue: 200,
      periodicUnit: "ms",
      start: true,
    });
    expect(timer.running).toBe(true);
    timer.configure({ running: false });
    expect(timer.running).toBe(false);
  });

  it("bypass=true stops an active periodic timer and prevents further ticks", () => {
    const { timer, app } = createTimer();

    timer.configure({
      periodic: true,
      periodicValue: 100,
      periodicUnit: "ms",
      start: true,
    });

    vi.advanceTimersByTime(250);
    expect(app.next).toHaveBeenCalledTimes(2);
    expect(timer.running).toBe(true);

    timer.configure({ bypass: true });
    expect(timer.running).toBe(false);

    vi.advanceTimersByTime(500);
    expect(app.next).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// configure() – periodic mode start
// ---------------------------------------------------------------------------

describe("Timer service – periodic mode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("start fires process at intervals and increments counter", () => {
    const { timer, app } = createTimer();
    timer.configure({
      periodic: true,
      periodicValue: 500,
      periodicUnit: "ms",
      start: true,
    });
    expect(timer.running).toBe(true);

    vi.advanceTimersByTime(500);
    expect(app.next).toHaveBeenCalledTimes(1);
    expect(app.next.mock.calls[0][1]).toEqual({ triggerCount: 1 });

    vi.advanceTimersByTime(500);
    expect(app.next).toHaveBeenCalledTimes(2);
    expect(app.next.mock.calls[1][1]).toEqual({ triggerCount: 2 });
  });

  it("getConfiguration reflects running periodic state", async () => {
    const { timer } = createTimer();
    timer.configure({
      periodic: true,
      periodicValue: 50,
      periodicUnit: "ms",
      start: true,
    });

    const cfg = await timer.getConfiguration();
    expect(cfg).toMatchObject({
      periodic: true,
      periodicValue: 50,
      periodicUnit: "ms",
      running: true,
    });
  });

  it("periodic 1 second fires every 1000 ms", () => {
    const { timer, app } = createTimer();
    timer.configure({
      periodic: true,
      periodicValue: 1,
      periodicUnit: "s",
      start: true,
    });

    vi.advanceTimersByTime(3000);
    expect(app.next).toHaveBeenCalledTimes(3);
  });

  it("periodic 100 ms fires 5 times in 500 ms", () => {
    const { timer, app } = createTimer();
    timer.configure({
      periodic: true,
      periodicValue: 100,
      periodicUnit: "ms",
      start: true,
    });
    vi.advanceTimersByTime(500);
    expect(app.next).toHaveBeenCalledTimes(5);
  });

  it("periodic 1 minute fires once after 60 seconds", () => {
    const { timer, app } = createTimer();
    timer.configure({
      periodic: true,
      periodicValue: 1,
      periodicUnit: "m",
      start: true,
    });
    vi.advanceTimersByTime(60_000);
    expect(app.next).toHaveBeenCalledTimes(1);
  });

  it("immediate flag fires one extra tick almost immediately after start", () => {
    const { timer, app } = createTimer();
    timer.configure({
      periodic: true,
      periodicValue: 1000,
      periodicUnit: "ms",
      start: true,
      immediate: true,
    });
    // IMMEDIATE_DELAY = 1 ms
    vi.advanceTimersByTime(2);
    expect(app.next).toHaveBeenCalledTimes(1);
    // Then another at 1000 ms
    vi.advanceTimersByTime(1000);
    expect(app.next).toHaveBeenCalledTimes(2);
  });

  it("changing periodicValue while running restarts silently", () => {
    const { timer, app } = createTimer();
    timer.configure({
      periodic: true,
      periodicValue: 1000,
      periodicUnit: "ms",
      start: true,
    });
    vi.advanceTimersByTime(500); // half-way through first tick
    expect(app.next).toHaveBeenCalledTimes(0);

    app.notify.mockClear();
    timer.configure({ periodicValue: 200 }); // changes interval, should restart
    vi.advanceTimersByTime(200);
    expect(app.next).toHaveBeenCalledTimes(1);
  });

  it("changing periodicUnit while running restarts silently", () => {
    const { timer, app } = createTimer();
    timer.configure({
      periodic: true,
      periodicValue: 1,
      periodicUnit: "s",
      start: true,
    });
    vi.advanceTimersByTime(500);

    timer.configure({ periodicUnit: "ms" }); // now 1 ms interval
    vi.advanceTimersByTime(5);
    expect(app.next.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("stop then start resets the counter", () => {
    const { timer, app } = createTimer();
    timer.configure({
      periodic: true,
      periodicValue: 100,
      periodicUnit: "ms",
      start: true,
    });
    vi.advanceTimersByTime(300);
    expect(app.next).toHaveBeenCalledTimes(3);

    timer.configure({ stop: true });
    app.next.mockClear();
    timer.configure({ start: true });
    vi.advanceTimersByTime(100);
    expect(app.next).toHaveBeenCalledTimes(1);
    // counter increments from 0 again after stop resets it
    expect(app.next.mock.calls[0][1].triggerCount).toBe(1);
  });

  it("restart stops and immediately resumes", () => {
    const { timer, app } = createTimer();
    timer.configure({
      periodic: true,
      periodicValue: 100,
      periodicUnit: "ms",
      start: true,
    });
    vi.advanceTimersByTime(250);
    timer.configure({ restart: true });
    app.next.mockClear();
    vi.advanceTimersByTime(100);
    expect(app.next).toHaveBeenCalledTimes(1);
    expect(app.next.mock.calls[0][1].triggerCount).toBe(1);
  });

  it("each tick notifies counter", () => {
    const { timer, app } = createTimer();
    timer.configure({
      periodic: true,
      periodicValue: 100,
      periodicUnit: "ms",
      start: true,
    });
    app.notify.mockClear();
    vi.advanceTimersByTime(100);
    expect(app.notify).toHaveBeenCalledWith(timer, { counter: 1 });
  });
});

// ---------------------------------------------------------------------------
// configure() – until condition
// ---------------------------------------------------------------------------

describe("Timer service – until condition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-stops after triggerCount exceeds the until limit", () => {
    const { timer, app } = createTimer();
    timer.configure({
      periodic: true,
      periodicValue: 100,
      periodicUnit: "ms",
      until: { triggerCount: 3 },
      start: true,
    });

    vi.advanceTimersByTime(700); // would fire 7 times without limit
    const firings = app.next.mock.calls.length;
    expect(firings).toBe(3); // stops after 3
    expect(timer.running).toBe(false);
  });

  it("until condition fire count is exact", () => {
    const { timer, app } = createTimer();
    timer.configure({
      periodic: true,
      periodicValue: 50,
      periodicUnit: "ms",
      until: { triggerCount: 5 },
      start: true,
    });

    vi.advanceTimersByTime(1000);
    expect(app.next).toHaveBeenCalledTimes(5);
  });
});

// ---------------------------------------------------------------------------
// configure() – one-shot via start (no process())
// ---------------------------------------------------------------------------

describe("Timer service – one-shot via configure(start)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires once after delay when periodic is false", () => {
    const { timer, app } = createTimer();
    timer.configure({ oneShotDelay: 300, oneShotDelayUnit: "ms", start: true });
    expect(app.next).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(app.next).toHaveBeenCalledTimes(1);
    expect(app.next.mock.calls[0][1]).toEqual({ triggerCount: 1 });
  });

  it("fires immediately when immediate flag is set (non-periodic)", () => {
    const { timer, app } = createTimer();
    timer.configure({ periodic: false, start: true, immediate: true });
    vi.advanceTimersByTime(2); // IMMEDIATE_DELAY = 1 ms
    expect(app.next).toHaveBeenCalledTimes(1);
  });

  it("one-shot with delay 0 ms fires after advancing 0 ms", () => {
    const { timer, app } = createTimer();
    timer.configure({
      periodic: false,
      oneShotDelay: 0,
      oneShotDelayUnit: "ms",
      start: true,
    });
    vi.advanceTimersByTime(0);
    expect(app.next).toHaveBeenCalledTimes(1);
  });

  it("one-shot with delay 1 s fires after 1000 ms", () => {
    const { timer, app } = createTimer();
    timer.configure({
      periodic: false,
      oneShotDelay: 1,
      oneShotDelayUnit: "s",
      start: true,
    });
    vi.advanceTimersByTime(999);
    expect(app.next).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(app.next).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// process() – one-shot (non-periodic) mode
// ---------------------------------------------------------------------------

describe("Timer service – process() one-shot mode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sleeps for oneShotDelay ms then returns params with triggerCount", async () => {
    const { timer, app } = createTimer();
    timer.configure({ oneShotDelay: 200, oneShotDelayUnit: "ms" });

    const resultP = timer.process({ key: "value" });
    vi.advanceTimersByTime(200);
    const result = await resultP;

    expect(result).toEqual({ key: "value", triggerCount: 1 });
    expect(app.notify).toHaveBeenCalledWith(timer, { counter: 1 });
  });

  it("increments triggerCount across successive process() calls", async () => {
    const { timer } = createTimer();
    timer.configure({ oneShotDelay: 0, oneShotDelayUnit: "ms" });

    let p1 = timer.process({});
    vi.advanceTimersByTime(0);
    const r1 = await p1;
    expect(r1.triggerCount).toBe(1);

    let p2 = timer.process({});
    vi.advanceTimersByTime(0);
    const r2 = await p2;
    expect(r2.triggerCount).toBe(2);
  });

  it("oneShotDelayUnit 's' multiplies delay by 1000", async () => {
    const { timer, app } = createTimer();
    timer.configure({ oneShotDelay: 2, oneShotDelayUnit: "s" });

    const resultP = timer.process({ n: 1 });
    vi.advanceTimersByTime(1999);
    expect(app.notify).not.toHaveBeenCalledWith(timer, {
      counter: expect.any(Number),
    });

    vi.advanceTimersByTime(1);
    const result = await resultP;
    expect(result).toEqual({ n: 1, triggerCount: 1 });
  });

  it("drops second process() call that arrives while already sleeping", async () => {
    const { timer, app } = createTimer();
    timer.configure({ oneShotDelay: 500, oneShotDelayUnit: "ms" });

    const p1 = timer.process({ call: 1 });
    // Second call arrives before first has resolved
    const p2 = timer.process({ call: 2 });
    vi.advanceTimersByTime(500);

    const [r1, r2] = await Promise.all([p1, p2]);
    // First call completes normally, second is dropped (returns params unchanged)
    expect(r1.triggerCount).toBe(1);
    // Dropped call returns params without triggerCount increment applied in sleep path
    expect(r2).toEqual({ call: 2 });
  });
});

// ---------------------------------------------------------------------------
// process() – periodic mode passthrough
// ---------------------------------------------------------------------------

describe("Timer service – process() periodic passthrough", () => {
  it("returns params unchanged when periodic is true", async () => {
    const { timer } = createTimer();
    timer.configure({ periodic: true });
    const result = await timer.process({ data: "hello" });
    expect(result).toEqual({ data: "hello" });
  });

  it("does not call app.notify on passthrough", async () => {
    const { timer, app } = createTimer();
    timer.configure({ periodic: true });
    app.notify.mockClear();
    await timer.process({ x: 1 });
    expect(app.notify).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// nextTimerArgument
// ---------------------------------------------------------------------------

describe("Timer service – nextTimerArgument", () => {
  it("increments counter each call starting from 0", () => {
    const { timer } = createTimer();
    expect(timer.nextTimerArgument()).toEqual({ triggerCount: 1 });
    expect(timer.nextTimerArgument()).toEqual({ triggerCount: 2 });
    expect(timer.nextTimerArgument()).toEqual({ triggerCount: 3 });
  });

  it("merges extra params with triggerCount", () => {
    const { timer } = createTimer();
    const result = timer.nextTimerArgument({ label: "tick" });
    expect(result).toEqual({ label: "tick", triggerCount: 1 });
  });
});

// ---------------------------------------------------------------------------
// destroy()
// ---------------------------------------------------------------------------

describe("Timer service – destroy()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears timer and sets running to false", () => {
    const { timer } = createTimer();
    timer.configure({
      periodic: true,
      periodicValue: 100,
      periodicUnit: "ms",
      start: true,
    });
    expect(timer.running).toBe(true);
    timer.destroy();
    expect(timer.running).toBe(false);
  });

  it("after destroy no more ticks fire", () => {
    const { timer, app } = createTimer();
    timer.configure({
      periodic: true,
      periodicValue: 100,
      periodicUnit: "ms",
      start: true,
    });
    timer.destroy();
    app.next.mockClear();
    vi.advanceTimersByTime(1000);
    expect(app.next).not.toHaveBeenCalled();
  });

  it("calling destroy on a stopped timer is safe", () => {
    const { timer } = createTimer();
    expect(() => timer.destroy()).not.toThrow();
  });
});
