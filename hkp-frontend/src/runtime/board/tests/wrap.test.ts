import { describe, expect, it } from "vitest";

import {
  contiguousRun,
  nameForRun,
  rewriteFacadeAddresses,
  runBetween,
  wrapProblems,
} from "../wrap";

const order = ["input", "pad", "on-a-hit", "the-hit", "output"];

describe("contiguousRun", () => {
  it("answers the picked ids in the runtime's order", () => {
    expect(contiguousRun(order, ["the-hit", "on-a-hit"])).toEqual(["on-a-hit", "the-hit"]);
  });

  it("refuses a run with a gap in it", () => {
    expect(contiguousRun(order, ["pad", "the-hit"])).toBeUndefined();
  });

  it("refuses an id the runtime does not hold, and an empty pick", () => {
    expect(contiguousRun(order, ["on-a-hit", "elsewhere"])).toBeUndefined();
    expect(contiguousRun(order, [])).toBeUndefined();
  });
});

describe("runBetween", () => {
  it("covers everything from the anchor to the service reached, either way", () => {
    expect(runBetween(order, "pad", "the-hit")).toEqual(["pad", "on-a-hit", "the-hit"]);
    expect(runBetween(order, "the-hit", "pad")).toEqual(["pad", "on-a-hit", "the-hit"]);
  });

  it("starts again from the service reached when the anchor is gone", () => {
    expect(runBetween(order, "removed", "pad")).toEqual(["pad"]);
  });
});

const svc = (uuid: string, state: Record<string, unknown> = {}) => ({
  uuid,
  serviceId: "hookup.to/service/map",
  serviceName: uuid,
  state,
});

const configurator = (uuid: string, target: string, targetRuntime?: string) => ({
  uuid,
  serviceId: "hookup.to/service/configurator",
  serviceName: uuid,
  state: { targetServiceUuid: target, ...(targetRuntime ? { targetRuntime } : {}) },
});

function check(
  services: Record<string, any[]>,
  { facades = [] as unknown[], asBlock = false, ids = ["on-a-hit", "the-hit"] } = {},
) {
  return wrapProblems({ services, facades, runtimeId: "ui", ids, asBlock });
}

describe("wrapProblems", () => {
  it("finds nothing to object to in a run nothing refers to", () => {
    expect(check({ ui: order.map((id) => svc(id)) })).toEqual([]);
  });

  it("refuses a target that would be left outside the run", () => {
    const problems = check({
      ui: [svc("pad"), configurator("on-a-hit", "pad"), svc("the-hit")],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("left outside");
  });

  it("refuses a target that would move into the run", () => {
    const problems = check({
      ui: [configurator("pad", "the-hit"), svc("on-a-hit"), svc("the-hit")],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("move into");
  });

  it("lets a reference with both ends in the run move with it", () => {
    expect(
      check({ ui: [svc("pad"), configurator("on-a-hit", "the-hit"), svc("the-hit")] }),
    ).toEqual([]);
  });

  it("leaves alone a service filed inside another, which moves as a whole", () => {
    const nested = {
      uuid: "scope",
      serviceId: "sub-service",
      state: { pipeline: [configurator("inner", "sibling"), svc("sibling")] },
    };
    expect(check({ ui: [nested, svc("on-a-hit")] }, { ids: ["on-a-hit"] })).toEqual([]);
  });

  it("refuses a target named on this runtime from another one", () => {
    const problems = check({
      ui: [svc("on-a-hit"), svc("the-hit")],
      node: [configurator("remote", "the-hit", "ui")],
    });
    expect(problems).toHaveLength(1);
  });

  it("does not mistake a same-named service on another runtime for one in the run", () => {
    expect(
      check({
        ui: [svc("on-a-hit"), svc("the-hit")],
        node: [configurator("remote", "the-hit")],
      }),
    ).toEqual([]);
  });

  it("refuses a mount reference to a service in the run", () => {
    const problems = check({
      ui: [svc("on-a-hit"), svc("the-hit"), svc("client", { url: "hkp-mount://ui/the-hit" })],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("hkp-mount://ui/the-hit");
  });

  it("lets a facade reach into the run by a longer address, but not into a block", () => {
    const services = { ui: order.map((id) => svc(id)) };
    const facades = [{ panels: [{ layout: { type: "text", serviceUuid: "the-hit" } }] }];
    expect(check(services, { facades })).toEqual([]);
    const problems = check(services, { facades, asBlock: true });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"the-hit"');
  });

  it("refuses a facade address it cannot tell apart from another runtime's service", () => {
    const problems = check(
      { ui: order.map((id) => svc(id)), node: [svc("the-hit")] },
      { facades: [{ type: "text", serviceUuid: "the-hit" }] },
    );
    expect(problems).toHaveLength(1);
  });
});

describe("rewriteFacadeAddresses", () => {
  it("sends every address into the run through the wrapper, and only those", () => {
    const facade = {
      panels: [
        { layout: { type: "text", serviceUuid: "the-hit" } },
        { layout: { type: "text", serviceUuid: "on-a-hit.inner" } },
        { layout: { type: "text", serviceUuid: "pad" } },
      ],
      notices: [{ source: { serviceUuid: "the-hit", path: "error" } }],
    };
    expect(rewriteFacadeAddresses(facade, ["on-a-hit", "the-hit"], "hit")).toEqual({
      panels: [
        { layout: { type: "text", serviceUuid: "hit.the-hit" } },
        { layout: { type: "text", serviceUuid: "hit.on-a-hit.inner" } },
        { layout: { type: "text", serviceUuid: "pad" } },
      ],
      notices: [{ source: { serviceUuid: "hit.the-hit", path: "error" } }],
    });
  });
});

describe("nameForRun", () => {
  it("names a short run after its services, a long one after its first", () => {
    expect(nameForRun(["On a hit", "The hit"])).toBe("On a hit + The hit");
    expect(nameForRun(["A", "B", "C"])).toBe("A + 2 more");
    expect(nameForRun([])).toBe("SubService");
  });
});
