/**
 * Iterator and Gather in the browser — the scopes that run a pipeline per item,
 * and per complete group.
 *
 * Both run their pipeline in a real nested scope, so these are the board's own
 * arrangement end to end. The cases mirror hkp-node's iterator and gather
 * tests: one board reads the same whichever runtime hosts it.
 */

import { describe, expect, it, vi } from "vitest";
import IteratorDescriptor from "../BrowserIterator";
import GatherDescriptor from "../BrowserGather";

function createApp() {
  return {
    notify: vi.fn(),
    next: vi.fn(),
    log: vi.fn(),
    sendAction: vi.fn(),
    getRuntimeVariable: vi.fn(() => ({})),
    setRuntimeVariable: vi.fn(),
  };
}

function create(descriptor: typeof IteratorDescriptor | typeof GatherDescriptor) {
  const app = createApp();
  const service = descriptor.create(app as any, "test-board", {} as any, "svc-1") as any;
  return { service, app };
}

const map = (instanceId: string, term: string) => ({
  serviceId: "hookup.to/service/map",
  instanceId,
  state: { mode: "replace", arrayMode: "single", template: { "=": term } },
});

const filter = (instanceId: string, condition: string) => ({
  serviceId: "hookup.to/service/filter",
  instanceId,
  state: { conditions: [condition] },
});

const notified = (app: ReturnType<typeof createApp>, key: string) =>
  app.notify.mock.calls
    .map(([, payload]: any[]) => payload)
    .filter((payload: any) => payload && key in payload);

describe("Iterator", () => {
  it("exports the shared service id", () => {
    expect(IteratorDescriptor.serviceId).toBe("iterator");
  });

  it("runs the nested pipeline once per element", async () => {
    const { service } = create(IteratorDescriptor);
    service.configure({ pipeline: [map("double", "params * 2")] });

    expect(await service.process([1, 2, 3])).toEqual([2, 4, 6]);
  });

  it("treats a single item as an array of one", async () => {
    const { service } = create(IteratorDescriptor);
    service.configure({ pipeline: [map("double", "params * 2")] });

    expect(await service.process(7)).toEqual([14]);
  });

  it("reaches into a result that says more than the list, and stops at the limit", async () => {
    const { service } = create(IteratorDescriptor);
    service.configure({
      itemsFrom: "rows",
      limit: 2,
      pipeline: [map("double", "params * 2")],
    });

    expect(await service.process({ rows: [1, 2, 3], count: 3 })).toEqual([2, 4]);
  });

  it("drops the items whose pipeline stopped, and passes nothing on when all did", async () => {
    const { service, app } = create(IteratorDescriptor);
    service.configure({ pipeline: [filter("keep", "params > 1")] });

    expect(await service.process([1, 2, 3])).toEqual([2, 3]);
    expect(await service.process([1])).toBeNull();
    // Still says what it did, so an empty pass is visible rather than silent.
    expect(notified(app, "items").at(-1)).toMatchObject({
      items: 1,
      results: 0,
      failed: 0,
    });
  });

  it("does nothing at all with nothing to do", async () => {
    const { service } = create(IteratorDescriptor);
    service.configure({ pipeline: [map("double", "params * 2")] });

    expect(await service.process([])).toBeNull();
    expect(await service.process(null)).toBeNull();
  });

  it("passes its input straight through with nothing in it", async () => {
    const { service } = create(IteratorDescriptor);
    service.configure({ pipeline: [] });

    expect(await service.process([1, 2])).toEqual([1, 2]);
  });

  it("hands on only what it collected, never an item's own answer", async () => {
    const { service, app } = create(IteratorDescriptor);
    service.configure({ pipeline: [map("double", "params * 2")] });

    await service.process([1, 2]);

    expect(app.next).not.toHaveBeenCalled();
  });

  it("keeps what it iterates over in what a board saves", async () => {
    const { service } = create(IteratorDescriptor);
    service.configure({ itemsFrom: "rows", limit: 5, pipeline: [map("double", "params * 2")] });

    const saved = await service.getConfiguration();
    expect(saved).toMatchObject({ itemsFrom: "rows", limit: 5 });
    expect(saved.pipeline.map((entry: any) => entry.instanceId)).toEqual(["double"]);
  });
});

const part = (group: string, index: number, total: number, item: unknown) => ({
  item,
  group,
  index,
  total,
});

describe("Gather", () => {
  it("exports the shared service id", () => {
    expect(GatherDescriptor.serviceId).toBe("gather");
  });

  it("passes nothing on until every part is in, then the items in order", async () => {
    const { service } = create(GatherDescriptor);

    expect(await service.process(part("g", 2, 3, "c"))).toBeNull();
    expect(await service.process(part("g", 0, 3, "a"))).toBeNull();
    expect(await service.process(part("g", 1, 3, "b"))).toEqual(["a", "b", "c"]);
  });

  it("keeps two groups apart, and counts a part sent twice once", async () => {
    const { service } = create(GatherDescriptor);

    await service.process(part("one", 0, 2, "1a"));
    await service.process(part("two", 0, 2, "2a"));
    expect(await service.process(part("one", 0, 2, "again"))).toBeNull();

    expect(await service.process(part("two", 1, 2, "2b"))).toEqual(["2a", "2b"]);
    expect(await service.process(part("one", 1, 2, "1b"))).toEqual(["1a", "1b"]);
  });

  it("passes on what is not a part", async () => {
    const { service } = create(GatherDescriptor);

    expect(await service.process("a whole file")).toBe("a whole file");
  });

  it("is what the pipeline makes of a complete group", async () => {
    const { service } = create(GatherDescriptor);
    service.configure({ pipeline: [map("join", "join(params.items, '')")] });

    await service.process(part("g", 1, 2, "world"));
    expect(await service.process(part("g", 0, 2, "hello "))).toBe("hello world");
  });

  it("is nothing passed on when the board says so", async () => {
    const { service } = create(GatherDescriptor);
    service.configure({ stopPropagation: true });

    expect(await service.process(part("g", 0, 1, "a"))).toBeNull();
  });

  it("refuses a group past maxBytes, with what is still on its way", async () => {
    const { service, app } = create(GatherDescriptor);
    service.configure({ maxBytes: 5 });

    await service.process(part("g", 0, 3, "abc"));
    expect(await service.process(part("g", 1, 3, "def"))).toBeNull();
    // The rest of a refused group does not start it again.
    expect(await service.process(part("g", 2, 3, "g"))).toBeNull();

    expect(service.progress).toEqual({
      pending: 0,
      error: "group g is larger than 5 bytes",
    });
    expect(app.log).toHaveBeenCalledWith(service, "error", "gather.refused", {
      group: "g",
      message: "group g is larger than 5 bytes",
    });
  });

  it("lets go of a group that stopped arriving", async () => {
    const { service, app } = create(GatherDescriptor);
    service.configure({ timeoutMs: 10 });

    await service.process(part("old", 0, 2, "a"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    await service.process(part("new", 0, 2, "b"));

    expect(service.progress.pending).toBe(1);
    expect(app.log).toHaveBeenCalledWith(service, "warn", "gather.timed-out", {
      group: "old",
      received: 1,
      total: 2,
    });
  });

  it("holds a part claiming an enormous total without allocating for it", async () => {
    const { service } = create(GatherDescriptor);

    expect(await service.process(part("g", 0, 2 ** 40, "a"))).toBeNull();
    expect(service.progress.pending).toBe(1);
  });

  it("keeps its limits in what a board saves", async () => {
    const { service } = create(GatherDescriptor);
    service.configure({ maxBytes: 1000, timeoutMs: 5000 });

    expect(await service.getConfiguration()).toMatchObject({
      maxBytes: 1000,
      timeoutMs: 5000,
    });
  });
});
