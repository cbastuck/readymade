import { describe, expect, it, vi } from "vitest";

import CacheDescriptor from "../Cache";

function makeCache(state: Record<string, unknown>) {
  const notify = vi.fn();
  const app = { notify, next: vi.fn() } as any;
  const service = CacheDescriptor.create(app, "board", {} as any, "cache-1") as any;
  service.configure(state);
  return { service, notify };
}

describe("Cache", () => {
  it("reports its configuration and values as separate fields", async () => {
    const { service, notify } = makeCache({
      updateTrigger: "process",
      initial: { x: 1, y: 2 },
    });

    await service.process({ x: 5 });

    expect(notify).toHaveBeenLastCalledWith(service, {
      updateTrigger: "process",
      initial: { x: 1, y: 2 },
      values: { x: 5, y: 2 },
    });
  });

  it("reports on every update a process makes", async () => {
    const { service, notify } = makeCache({ updateTrigger: "process" });
    notify.mockClear();

    await service.process({ a: 1 });
    await service.process({ a: 2 });

    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify.mock.calls[1][1].values).toEqual({ a: 2 });
  });

  it("keeps its setup on the board, not the values it gathered", async () => {
    const { service } = makeCache({
      updateTrigger: "process",
      initial: { x: 1 },
    });
    await service.process({ x: 9 });

    expect(await service.getConfiguration()).toEqual({
      updateTrigger: "process",
      initial: { x: 1 },
      bypass: false,
    });
  });
});
