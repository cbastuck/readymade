import { describe, expect, it, vi } from "vitest";

import MapDescriptor from "../base/Map";
import board from "../../../../../boards/audiolize-board.json";

/**
 * The lane each track takes for itself.
 *
 * The board fans a keypress into two notes, and the two aggregators after them
 * each want one of those notes. Under `tracks` every track is given the whole
 * array, so each says which element is its own — and a Map given an array maps
 * over its *elements* unless told the array is the subject. Missing that, every
 * lane answered null for every note, and the synth was handed a grid of
 * nothing.
 */

const MapService = MapDescriptor.Map;

function aggregates() {
  return (board.services.ui as any[]).find((svc) => svc.uuid === "aggregates-svc");
}

function laneMaps() {
  return (aggregates().state.tracks as any[]).map((track) => track.pipeline[0]);
}

async function run(state: Record<string, unknown>, input: unknown) {
  const app = {
    notify: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
    processRuntimeByName: vi.fn(),
    getRuntimeVariable: vi.fn(() => ({})),
    setRuntimeVariable: vi.fn(),
  };
  const service = new MapService(app as any, "test-board", {} as any, "map-1") as any;
  service.configure(state);
  return await service.process(input);
}

describe("audiolize's lanes", () => {
  it("takes one note per track out of the notes the tracks before it answered", async () => {
    const notes = [{ note: "D4" }, { note: "C4" }];
    const answers = await Promise.all(
      laneMaps().map((lane) => run(lane.state, notes)),
    );

    expect(answers).toEqual([{ note: "D4" }, { note: "C4" }]);
  });

  it("says the array is the subject, not each element of it", () => {
    for (const lane of laneMaps()) {
      expect(lane.state.arrayMode).toBe("single");
    }
  });

  it("stops the pass when neither aggregator had anything to play", async () => {
    // The aggregators collect over an interval and emit on their own, so on the
    // pass that feeds them they answer nothing. Handing the synth a pair of
    // nulls on every keystroke is noise; the reducer is where a board says that
    // silence means stop.
    const reduce = aggregates().state.reduce[0];

    expect(await run(reduce.state, { results: [null, null] })).toBeNull();
    expect(await run(reduce.state, { results: [null, { note: "C4" }] })).toEqual([
      null,
      { note: "C4" },
    ]);
  });
});
