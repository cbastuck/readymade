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
 * hit sits in the nesting. One bar of it, played under fake timers, has to put
 * every drum on its eighth — and exactly once, since a scope that handed its
 * answer on twice would double everything after it.
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

/** The board's Groove, built as the runtime builds it. */
async function buildGroove() {
  const grooveEntry = (board.services.ui as any[]).find((s) => s.uuid === "groove");
  const app = makeApp();
  const groove = new BrowserSubService(app, "board", {} as any, "groove");
  groove.configure(grooveEntry.state);
  await (groove as any)._scopeBuilding;
  const bar = groove.getInnerInstance("bar")!;
  return { groove, bar, app };
}

describe("the Nested Rhythm demo board", () => {
  it("is one scope holding the tempo, a clock counting bars in beats, and the bar", () => {
    const [groove] = board.services.ui as any[];
    expect(groove.serviceId).toBe("sub-service");
    expect(groove.state.scope).toEqual({ slots: "own" });
    expect(groove.state.stopPropagation).toBe(true);

    const pipeline = groove.state.pipeline;
    expect(pipeline.map((e: any) => e.instanceId)).toEqual(["tempo", "clock", "bar"]);
    expect(entry(pipeline, "tempo").state).toEqual({ slot: "tempo", op: "write", value: 120 });
    expect(entry(pipeline, "clock").state).toMatchObject({
      periodic: true,
      periodicValue: 4,
      periodicUnit: "beats",
    });
  });

  it("has every scope inside the Groove inherit its slots", () => {
    // Without it a scope keeps cells of its own, finds no tempo there, and
    // counts at the default instead of the board's.
    const scopes: any[] = [];
    const visit = (pipeline: any[]) => {
      for (const e of pipeline) {
        if (e.serviceId === "sub-service") {
          scopes.push(e);
          visit(e.state.pipeline);
        }
      }
    };
    visit((board.services.ui as any[])[0].state.pipeline);
    expect(scopes.length).toBe(7); // Bar, 2 × Two beats, 4 × Beat
    for (const scope of scopes) {
      expect(scope.state.scope).toEqual({ slots: "inherit" });
    }
  });

  it("plays one bar: kick on 1, snare on 2 and 4, hi-hats on every eighth", async () => {
    const { bar, groove, app } = await buildGroove();

    const played = bar.process({ triggerCount: 1 });
    await vi.advanceTimersByTimeAsync(8 * EIGHTH_MS);
    await played;

    expect(at("kick")).toEqual([0]);
    expect(at("snare")).toEqual([2, 6]);
    expect(at("hihat")).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    // Answered by returning; nothing pushed onward besides.
    expect(app.next).not.toHaveBeenCalled();
    groove.destroy();
  });

  it("follows the tempo held in the Groove, at every level", async () => {
    const { bar, groove } = await buildGroove();
    // What the tempo knob does: configure the Hold, which writes the slot.
    (groove.getInnerInstance("tempo") as any).configure({ value: "60" });

    const played = bar.process({ triggerCount: 1 });
    await vi.advanceTimersByTimeAsync(16 * EIGHTH_MS);
    await played;

    // Half the tempo: every hit twice as far apart.
    expect(at("snare")).toEqual([4, 12]);
    expect(at("hihat")).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    groove.destroy();
  });

  it("counts at the tempo a board is loaded with", async () => {
    // The Hold writes its value while the Groove is being built, so it has to
    // land in the cells the Groove goes on using — at 120 this would pass on
    // the Timer's default alone, so the board is loaded at another tempo.
    const grooveEntry = structuredClone(
      (board.services.ui as any[]).find((s) => s.uuid === "groove"),
    );
    entry(grooveEntry.state.pipeline, "tempo").state.value = 240;
    const groove = new BrowserSubService(makeApp(), "board", {} as any, "groove");
    groove.configure(grooveEntry.state);
    await (groove as any)._scopeBuilding;

    const played = groove.getInnerInstance("bar")!.process({ triggerCount: 1 });
    await vi.advanceTimersByTimeAsync(4 * EIGHTH_MS);
    await played;

    // Double the tempo: an eighth is half an EIGHTH_MS.
    expect(at("snare")).toEqual([1, 3]);
    expect(at("hihat")).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    groove.destroy();
  });

  it("stops at once when the Groove is cancelled mid-bar, and plays again after", async () => {
    // What Stop does besides stopping the clock: without it the bar already
    // playing would play out to its end.
    const { bar, groove } = await buildGroove();
    const played = bar.process({ triggerCount: 1 });
    await vi.advanceTimersByTimeAsync(3 * EIGHTH_MS + 10);
    groove.configure({ cancel: true });
    await vi.advanceTimersByTimeAsync(8 * EIGHTH_MS);

    expect(await played).toBeNull();
    expect(Math.max(...hits.map(([eighth]) => eighth))).toBe(3);

    hits = [];
    const again = bar.process({ triggerCount: 2 });
    await vi.advanceTimersByTimeAsync(8 * EIGHTH_MS);
    await again;
    expect(at("hihat")).toHaveLength(8);
    groove.destroy();
  });

  it("saves the tempo a control set, not the one it was built with", async () => {
    const { groove } = await buildGroove();
    (groove.getInnerInstance("tempo") as any).configure({ value: "90" });

    const saved = await groove.getConfiguration();
    expect(entry(saved.pipeline!, "tempo").state).toMatchObject({ value: "90" });
    groove.destroy();
  });
});
