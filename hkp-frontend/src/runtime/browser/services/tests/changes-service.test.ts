import { describe, expect, it, vi } from "vitest";

import ChangesDescriptor from "../Changes";

/**
 * Changes turns a stream of reports into events: the input passes only when
 * what it watches differs from what it watched last time.
 */

function makeChanges(state: Record<string, unknown> = {}) {
  const app = {
    notify: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
    getRuntimeVariable: () => ({}),
  } as any;
  const service = ChangesDescriptor.create(app, "board", {} as any, "changes-1") as any;
  service.configure(state);
  return { service, app };
}

async function run(service: any, inputs: unknown[]) {
  const out: unknown[] = [];
  for (const input of inputs) {
    out.push(await service.process(input));
  }
  return out;
}

describe("Changes", () => {
  it("passes the whole input when it differs from the last one", async () => {
    const { service } = makeChanges();
    expect(await run(service, ["a", "a", "b", "b", "a"])).toEqual(["a", null, "b", null, "a"]);
  });

  it("compares objects by what they say, not by identity", async () => {
    const { service } = makeChanges();
    expect(await run(service, [{ n: 1 }, { n: 1 }, { n: 2 }])).toEqual([{ n: 1 }, null, { n: 2 }]);
  });

  it("sees a change in an object that is reused and given other content", async () => {
    const { service } = makeChanges();
    const input = { n: 1 };
    expect(await service.process(input)).toBe(input);
    expect(await service.process(input)).toBeNull();
    input.n = 2;
    expect(await service.process(input)).toBe(input);
    expect(await service.process(input)).toBeNull();
  });

  it("takes binary content JSON cannot read as changed whenever it is another object", async () => {
    const { service } = makeChanges();
    const first = new Blob(["one"]);
    const second = new Blob(["two"]);
    expect(await run(service, [first, first, second, second])).toEqual([
      first,
      null,
      second,
      null,
    ]);

    const buffers = makeChanges().service;
    const a = new ArrayBuffer(4);
    const b = new ArrayBuffer(4);
    expect(await run(buffers, [a, b, b])).toEqual([a, b, null]);
  });

  it("sees binary content change inside an object, and bytes by what they hold", async () => {
    const { service } = makeChanges();
    const image = new Blob(["frame"]);
    const frames = [
      { id: 1, image },
      { id: 1, image },
      { id: 1, image: new Blob(["frame"]) },
    ];
    expect(await run(service, frames)).toEqual([frames[0], null, frames[2]]);

    const bytes = makeChanges().service;
    const inputs = [new Uint8Array([1, 2]), new Uint8Array([1, 2]), new Uint8Array([1, 3])];
    expect(await run(bytes, inputs)).toEqual([inputs[0], null, inputs[2]]);
  });

  it("watches an expression and passes the input it was read from", async () => {
    const { service } = makeChanges({ value: "params.count > 0", emit: "rise" });
    const frames = [
      { count: 0 },
      { count: 1 },
      { count: 2 },
      { count: 0 },
      { count: 1 },
    ];
    expect(await run(service, frames)).toEqual([null, { count: 1 }, null, null, { count: 1 }]);
  });

  it("counts a truthy first value as a rise, and a falsy one as no fall", async () => {
    const rise = makeChanges({ value: "params.on", emit: "rise" }).service;
    expect(await run(rise, [{ on: true }])).toEqual([{ on: true }]);
    const fall = makeChanges({ value: "params.on", emit: "fall" }).service;
    expect(await run(fall, [{ on: false }, { on: true }, { on: false }])).toEqual([
      null,
      null,
      { on: false },
    ]);
  });

  it("forgets on reset, and when the expression changes", async () => {
    const { service } = makeChanges({ value: "params.on", emit: "rise" });
    await run(service, [{ on: true }]);
    service.configure({ reset: true });
    expect(await service.process({ on: true })).toEqual({ on: true });
    service.configure({ value: "params.other" });
    expect(service.remembered).toEqual({ seen: false, value: undefined });
  });

  it("keeps what it remembers out of the board's configuration", async () => {
    const { service } = makeChanges({ value: "params.on" });
    await run(service, [{ on: true }]);
    expect(await service.getConfiguration()).toEqual({
      value: "params.on",
      emit: "change",
      bypass: false,
    });
    expect(service.remembered).toEqual({ seen: true, value: true });
  });

  it("stops, and says so, on an expression it cannot read", async () => {
    const { service, app } = makeChanges({ value: "params.(" });
    expect(await service.process({})).toBeNull();
    expect(app.sendAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "notification" }),
    );
  });
});
