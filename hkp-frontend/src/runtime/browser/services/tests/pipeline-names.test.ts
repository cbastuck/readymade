import { describe, expect, it, vi } from "vitest";

import { BrowserSubService } from "../BrowserSubService";
import { renamedEntries } from "../../pipelineNames";

const entry = (instanceId: string, extra: Record<string, unknown> = {}) => ({
  serviceId: "hookup.to/service/monitor",
  instanceId,
  state: { a: 1 },
  ...extra,
});

describe("renamedEntries", () => {
  it("gives the entries their new names when only a name changed", () => {
    const current = [entry("x"), entry("y", { serviceName: "Old" })];
    const next = [entry("x", { serviceName: "First" }), entry("y")];

    expect(renamedEntries(current, next)).toEqual([
      entry("x", { serviceName: "First" }),
      entry("y"),
    ]);
  });

  it("is null when nothing changed", () => {
    expect(renamedEntries([entry("x")], [entry("x")])).toBeNull();
  });

  it("is null when anything besides a name changed", () => {
    const current = [entry("x"), entry("y")];
    expect(renamedEntries(current, [entry("y"), entry("x")])).toBeNull();
    expect(
      renamedEntries(current, [entry("x", { serviceName: "N" })]),
    ).toBeNull();
    expect(
      renamedEntries(current, [
        entry("x", { serviceName: "N", state: { a: 2 } }),
        entry("y"),
      ]),
    ).toBeNull();
    expect(renamedEntries(current, undefined)).toBeNull();
  });
});

describe("renaming a service inside a sub-service", () => {
  it("renames the entry and the running service without rebuilding", async () => {
    const app = { notify: vi.fn(), next: vi.fn(), slots: () => null } as any;
    const sub = new BrowserSubService(app, "board", {} as any, "sub");
    sub.configure({ pipeline: [entry("inner")] });
    await sub._scopeBuilding;
    const scope = sub._scope;
    const running = sub.getInnerInstance("inner");
    expect(running).not.toBeNull();

    sub.configure({
      pipeline: sub.state.pipeline.map((e) => ({ ...e, serviceName: "Tap" })),
    });

    expect(sub._scope).toBe(scope);
    expect(sub.getInnerInstance("inner")).toBe(running);
    expect(running!.serviceName).toBe("Tap");
    expect(sub.state.pipeline[0].serviceName).toBe("Tap");
  });
});
