import { describe, expect, it, vi } from "vitest";

import api from "../../BrowserRuntimeApi";
import BrowserRuntimeScope from "../../BrowserRuntimeScope";
import SpreadDescriptor from "../Spread";
import { chunkText } from "../FileSource";
import { ProcessContext } from "hkp-frontend/src/types";

/**
 * Spread: one value in, as many out as it has items. What is worth pinning is
 * that each item leaves the runtime by itself — that is the whole reason the
 * service exists — and what each one carries for a Gather to put the array
 * back together.
 */

function makeSpread(state: Record<string, unknown> = {}) {
  const next = vi.fn(async () => null);
  const notify = vi.fn();
  const app = { next, notify } as any;
  const service = SpreadDescriptor.create(app, "board", {} as any, "spread-1") as any;
  service.configure(state);
  return { service, next, notify };
}

describe("Spread", () => {
  it("sends each item on by itself, saying where it sat", async () => {
    const { service, next } = makeSpread();

    expect(await service.process(["a", "b", "c"])).toBeNull();

    const sent = next.mock.calls.map(([, value]: any[]) => value);
    expect(sent.map((part: any) => [part.item, part.index, part.total])).toEqual([
      ["a", 0, 3],
      ["b", 1, 3],
      ["c", 2, 3],
    ]);
    // One group per array, the same for all of its items.
    expect(new Set(sent.map((part: any) => part.group)).size).toBe(1);
  });

  it("gives each array a group of its own", async () => {
    const { service, next } = makeSpread();

    await service.process(["a"]);
    await service.process(["b"]);

    const groups = next.mock.calls.map(([, value]: any[]) => value.group);
    expect(groups[0]).not.toBe(groups[1]);
  });

  it("treats a single item as an array of one", async () => {
    const { service, next } = makeSpread();

    await service.process({ x: 1 });

    expect(next.mock.calls.map(([, value]: any[]) => value)).toMatchObject([
      { item: { x: 1 }, index: 0, total: 1 },
    ]);
  });

  it("reaches into a result that says more than the list", async () => {
    const { service, next } = makeSpread({ itemsFrom: "rows" });

    await service.process({ rows: [1, 2], count: 2 });

    expect(next.mock.calls.map(([, value]: any[]) => value.item)).toEqual([1, 2]);
  });

  it("sends nothing on for nothing", async () => {
    const { service, next } = makeSpread();

    expect(await service.process(null)).toBeNull();
    expect(await service.process([])).toBeNull();
    expect(next).not.toHaveBeenCalled();
  });

  it("keeps where its items come from on the board", async () => {
    const { service, notify } = makeSpread({ itemsFrom: "rows" });

    expect(await service.getConfiguration()).toEqual({ itemsFrom: "rows", bypass: false });
    expect(notify).toHaveBeenCalledWith(service, { itemsFrom: "rows" });
  });
});

describe("Spread in a runtime", () => {
  it("makes each item a result of its own, in the run that reached it", async () => {
    const { scope: scope_ } = await api.addRuntime(
      { name: "Browser", type: "browser" } as any,
      null,
      "test-board",
    );
    const scope = scope_ as BrowserRuntimeScope;
    const results: Array<{ result: unknown; context: unknown }> = [];
    scope.onResult = async (_uuid, result, context) => {
      results.push({ result, context });
    };
    await api.addService(scope, {
      serviceId: "spread",
      serviceName: "Spread",
    } as any);
    await api.addService(scope, {
      serviceId: "hookup.to/service/monitor",
      serviceName: "After",
    } as any);

    const run = { runId: "run-1", actor: { kind: "board" } } as ProcessContext;
    await scope.next(null, ["one", "two"], run, false);

    // Two results that go on to the next runtime, then the null the Spread's
    // own pass ended in, which goes nowhere.
    expect(results.map((entry) => (entry.result as any)?.item ?? null)).toEqual([
      "one",
      "two",
      null,
    ]);
    expect(results.every((entry) => entry.context === run)).toBe(true);
  });
});

describe("File Source chunks", () => {
  it("cuts text into pieces of at most the chunk size, in order", () => {
    expect(chunkText("abcdefg", 3)).toEqual(["abc", "def", "g"]);
    expect(chunkText("abc", 10)).toEqual(["abc"]);
  });

  it("is one empty piece for an empty text, so an empty file still arrives", () => {
    expect(chunkText("", 3)).toEqual([""]);
  });

  it("never cuts between the halves of a surrogate pair", () => {
    const text = "ab😀cd"; // the emoji is two UTF-16 units
    const chunks = chunkText(text, 3);

    expect(chunks.join("")).toBe(text);
    expect(chunks).toEqual(["ab", "😀c", "d"]);
  });
});
