import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The registry first, as the app loads it: the sub-service and the registry
// import each other, and entered from the sub-service side the registry would
// list the sub-service before it is defined — so no scope could nest another.
import "../../BrowserRegistry";
import SoundDescriptor from "../Sound";
import { BrowserSubService } from "../BrowserSubService";
import { createSlotStore } from "../../../slots";
import board from "../../../../../../boards/nested-rhythm-demo-board.json";

/**
 * The Nested Rhythm demo board: a groove whose timing is nothing but where each
 * hit sits in the nesting. One bar of each pattern, played under fake timers,
 * has to put every drum where the pattern says — and exactly once, since a
 * scope that handed its answer on twice would double everything after it.
 */

const EIGHTH_MS = 250;

function makeApp() {
  const slots = createSlotStore();
  return {
    notify: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
    slots: () => slots,
  } as any;
}

class SilentAudioContext {
  state = "running";
  resume() {}
  close() {}
}

let hits: Array<[number, string]> = [];

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
  });
  vi.stubGlobal("AudioContext", SilentAudioContext);
  hits = [];
  const start = Date.now();
  // Every Sound on the board is this class, whichever scope built it.
  const probe = SoundDescriptor.create(makeApp(), "b", {} as any, "probe");
  vi.spyOn(Object.getPrototypeOf(probe), "playDrum").mockImplementation(
    function (_ctx: unknown, drum: unknown) {
      hits.push([(Date.now() - start) / EIGHTH_MS, drum as string]);
    },
  );
  probe.destroy();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function at(drum: string) {
  return hits.filter(([, d]) => d === drum).map(([eighth]) => eighth);
}

function entry(pipeline: any[], id: string) {
  return pipeline.find((e) => e.instanceId === id);
}

function grooveEntry() {
  return structuredClone(
    (board.services.ui as any[]).find((s) => s.uuid === "groove"),
  );
}

/** The board's Groove, built as the runtime builds it. */
async function buildGroove(state = grooveEntry().state) {
  const app = makeApp();
  const groove = new BrowserSubService(app, "board", {} as any, "groove");
  groove.configure(state);
  await (groove as any)._scopeBuilding;
  return { groove, app };
}

/** One bar, entered where the clock's tick enters it. */
async function playBar(groove: BrowserSubService, beats = 4) {
  const played = groove.processNested("clock", { triggerCount: 1 });
  await vi.advanceTimersByTimeAsync(beats * 2 * EIGHTH_MS);
  return played;
}

function choose(groove: BrowserSubService, pattern: string) {
  (groove.getInnerInstance("pattern") as any).configure({ value: pattern });
}

/** Positions in eighths, to the nearest hundredth — swing is in thirds. */
function near(values: number[]) {
  return values.map((v) => Math.round(v * 100) / 100);
}

const sixteenths = Array.from({ length: 16 }, (_, i) => i / 2);

describe("the Nested Rhythm demo board", () => {
  it("is one scope holding the tempo and the pattern, a clock, and a Switch over the patterns", () => {
    const [groove] = board.services.ui as any[];
    expect(groove.serviceId).toBe("sub-service");
    expect(groove.state.scope).toEqual({ slots: "own" });
    expect(groove.state.stopPropagation).toBe(true);

    const pipeline = groove.state.pipeline;
    expect(pipeline.map((e: any) => e.instanceId)).toEqual([
      "tempo",
      "pattern",
      "clock",
      "which",
      "patterns",
    ]);
    expect(entry(pipeline, "tempo").state).toEqual({ slot: "tempo", op: "write", value: 120 });
    expect(entry(pipeline, "pattern").state).toEqual({
      slot: "pattern",
      op: "write",
      value: "straight",
    });
    expect(entry(pipeline, "which").state).toEqual({ slot: "pattern", op: "read" });
    expect(entry(pipeline, "clock").state).toMatchObject({
      periodic: true,
      periodicValue: 4,
      periodicUnit: "beats",
    });
    const cases = entry(pipeline, "patterns").state.cases;
    expect(cases.map((c: any) => c.pipeline[0].instanceId)).toEqual([
      "straight",
      "shuffle",
      "four-on-the-floor",
      "funk",
    ]);
  });

  it("has every scope inside the Groove inherit its slots", () => {
    // Without it a scope keeps cells of its own, finds no tempo there, and
    // counts at the default instead of the board's.
    const scopes: any[] = [];
    const visit = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (value && typeof value === "object") {
        const e = value as any;
        if (e.serviceId === "sub-service") {
          scopes.push(e);
        }
        Object.values(e).forEach(visit);
      }
    };
    visit(entry((board.services.ui as any[])[0].state.pipeline, "patterns"));
    expect(scopes.length).toBeGreaterThan(20);
    for (const scope of scopes) {
      expect(scope.state.scope).toEqual({ slots: "inherit" });
    }
  });

  it("plays Straight: kick on 1, snare on 2 and 4, hi-hats on every eighth", async () => {
    const { groove, app } = await buildGroove();
    await playBar(groove);

    expect(at("kick")).toEqual([0]);
    expect(at("snare")).toEqual([2, 6]);
    expect(at("hihat")).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    // Nothing leaves the Groove, and nothing ran twice.
    expect(app.next).not.toHaveBeenCalled();
    groove.destroy();
  });

  it("plays Shuffle: swung hi-hats, kick on 1 and 3", async () => {
    const { groove } = await buildGroove();
    choose(groove, "shuffle");
    await playBar(groove);

    expect(at("kick")).toEqual([0, 4]);
    expect(near(at("snare"))).toEqual([2, 6]);
    // The second hi-hat of each beat two thirds of the way through it.
    expect(near(at("hihat"))).toEqual([0, 1.33, 2, 3.33, 4, 5.33, 6, 7.33]);
    groove.destroy();
  });

  it("plays Four on the floor: a kick on every beat, hi-hats on the off-beats", async () => {
    const { groove } = await buildGroove();
    choose(groove, "four-on-the-floor");
    await playBar(groove);

    expect(at("kick")).toEqual([0, 2, 4, 6]);
    expect(at("snare")).toEqual([2, 6]);
    expect(at("hihat")).toEqual([1, 3, 5, 7]);
    groove.destroy();
  });

  it("plays Funk: sixteenth hi-hats, kicks pushed onto the and of 2 and of 3", async () => {
    const { groove } = await buildGroove();
    choose(groove, "funk");
    await playBar(groove);

    expect(at("kick")).toEqual([0, 3, 5]);
    expect(at("snare")).toEqual([2, 6]);
    expect(at("hihat")).toEqual(sixteenths);
    groove.destroy();
  });

  it("follows the tempo held in the Groove, at every level, through the Switch", async () => {
    const { groove } = await buildGroove();
    // What the tempo knob does: configure the Hold, which writes the slot.
    (groove.getInnerInstance("tempo") as any).configure({ value: "60" });
    await playBar(groove, 8);

    // Half the tempo: every hit twice as far apart.
    expect(at("snare")).toEqual([4, 12]);
    expect(at("hihat")).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    groove.destroy();
  });

  it("counts at the tempo and plays the pattern a board is loaded with", async () => {
    // The Holds write while the Groove is being built, so what they write has
    // to land in the cells the Groove goes on using — at 120 this would pass
    // on the Timer's default alone, so the board is loaded at another tempo.
    const state = grooveEntry().state;
    entry(state.pipeline, "tempo").state.value = 240;
    entry(state.pipeline, "pattern").state.value = "four-on-the-floor";
    const { groove } = await buildGroove(state);
    await playBar(groove, 2);

    // Double the tempo: an eighth is half an EIGHTH_MS.
    expect(at("kick")).toEqual([0, 1, 2, 3]);
    expect(at("hihat")).toEqual([0.5, 1.5, 2.5, 3.5]);
    groove.destroy();
  });

  it("stops at once when the Groove is cancelled mid-bar, and plays again after", async () => {
    // What Stop does besides stopping the clock: without it the bar already
    // playing would play out to its end.
    const { groove } = await buildGroove();
    const played = groove.processNested("clock", { triggerCount: 1 });
    await vi.advanceTimersByTimeAsync(3 * EIGHTH_MS + 10);
    groove.configure({ cancel: true });
    await vi.advanceTimersByTimeAsync(8 * EIGHTH_MS);

    expect(await played).toBeNull();
    expect(Math.max(...hits.map(([eighth]) => eighth))).toBe(3);

    hits = [];
    await playBar(groove);
    expect(at("hihat")).toHaveLength(8);
    groove.destroy();
  });

  it("reports what happens inside a pattern under its address through the Switch", async () => {
    // What the overview and the panels listen for: a hit inside a case is
    // reported as groove.patterns.straight.kick, not under its bare name.
    const { groove, app } = await buildGroove();
    await playBar(groove);

    const addresses = new Set(
      app.notify.mock.calls.map(([svc]: any[]) => svc.address).filter(Boolean),
    );
    expect(addresses).toContain("groove.patterns.straight.kick");
    expect(addresses).toContain("groove.patterns.straight.half-1.beat-1.hihat-1");
    groove.destroy();
  });

  it("saves the tempo and pattern a control set, not the ones it was built with", async () => {
    const { groove } = await buildGroove();
    (groove.getInnerInstance("tempo") as any).configure({ value: "90" });
    choose(groove, "funk");

    const saved = await groove.getConfiguration();
    expect(entry(saved.pipeline!, "tempo").state).toMatchObject({ value: "90" });
    expect(entry(saved.pipeline!, "pattern").state).toMatchObject({ value: "funk" });
    groove.destroy();
  });
});
