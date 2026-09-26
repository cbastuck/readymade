import { describe, expect, it } from "vitest";

import { ActivityTracker, PULSE_MS, describeResult } from "../activity";
import { buildScene } from "../graph";
import { RuntimeDescriptor, ServiceDescriptor } from "hkp-frontend/src/types";

const runtimes = [
  { id: "ui", name: "Browser", type: "browser" },
] as unknown as RuntimeDescriptor[];

const services = {
  ui: [
    { uuid: "a", serviceId: "x", serviceName: "A" },
    { uuid: "b", serviceId: "y", serviceName: "B" },
  ] as unknown as ServiceDescriptor[],
};

/**
 * A board listening the way a runtime does: filed under a service's address
 * where it has one, and under its uuid otherwise. Keyed exactly as
 * `runtime/NotificationsTargets` keys it, since that is what a registration
 * has to meet to hear anything.
 */
function trackerOnBoard(
  board: { [runtimeId: string]: ServiceDescriptor[] } = services,
) {
  const targets = new Map<string, (n: any) => void>();
  const key = (svc: any) => svc.address ?? svc.uuid;
  const app = {
    registerNotificationTarget: (svc: any, cb: any) =>
      targets.set(key(svc), cb),
    unregisterNotificationTarget: (svc: any) => targets.delete(key(svc)),
  };
  const scopes = { ui: { getApp: () => app } } as any;

  const scene = buildScene(runtimes, board);
  const tracker = new ActivityTracker();
  const detach = tracker.attach(scene.nodes, scene.edges, scopes);
  return { tracker, targets, detach };
}

/** A pipeline inside a service, with one more inside that. */
const scoped = {
  ui: [
    { uuid: "a", serviceId: "x", serviceName: "A" },
    {
      uuid: "host",
      serviceId: "sub-service",
      serviceName: "SubService",
      state: {
        pipeline: [
          { instanceId: "inner", serviceId: "timer" },
          {
            instanceId: "deeper-host",
            serviceId: "sub-service",
            state: { pipeline: [{ instanceId: "deepest", serviceId: "y" }] },
          },
        ],
      },
    },
  ] as unknown as ServiceDescriptor[],
};

describe("ActivityTracker", () => {
  it("registers for every service, including ones with no panel on screen", () => {
    const { targets } = trackerOnBoard();
    expect([...targets.keys()].sort()).toEqual(["a", "b"]);
  });

  it("listens for a scoped service where its scope reports it", () => {
    const { tracker, targets } = trackerOnBoard(scoped);

    // A scope forwards what happens inside it under the path through the
    // services containing it, so that is what has to be listened for.
    expect([...targets.keys()].sort()).toEqual([
      "a",
      "host",
      "host.deeper-host",
      "host.deeper-host.deepest",
      "host.inner",
    ]);

    targets.get("host.inner")!({
      __internal: { state: "call-process", data: null },
    });
    targets.get("host.inner")!({
      __internal: { state: "call-process-finished", data: { tick: 1 } },
    });
    // Reported under the address, and kept under it: a name is only unique
    // within its own pipeline, so two copies of one block would otherwise
    // light each other up.
    expect(tracker.get("host.inner")!.calls).toBe(1);
    expect(tracker.get("host.inner")!.lastOut!.summary).toBe("object 1");
    expect(tracker.get("inner")).toBeUndefined();
  });

  it("keeps what a call was given as well as what it answered", () => {
    const { tracker, targets } = trackerOnBoard();
    targets.get("a")!({
      __internal: { state: "call-process", data: { tick: 7 } },
    });
    expect(tracker.get("a")!.lastIn!.preview).toBe("{tick: 7}");
    expect(tracker.get("a")!.lastIn!.summary).toBe("object 1");
    // Nothing has come back yet, so there is nothing to say about it.
    expect(tracker.get("a")!.lastOut).toBeUndefined();

    targets.get("a")!({
      __internal: { state: "call-process-finished", data: [1, 2] },
    });
    expect(tracker.get("a")!.lastOut!.preview).toBe("[1, 2]");
    expect(tracker.get("a")!.lastIn!.preview).toBe("{tick: 7}");
  });

  it("does not hold on to what crossed, only to what it said about it", () => {
    const { tracker, targets } = trackerOnBoard();
    const buffer = new Float32Array(1024);
    targets.get("a")!({
      __internal: { state: "call-process", data: { audio: buffer } },
    });

    const kept = tracker.get("a")!.lastIn!;
    expect(typeof kept.preview).toBe("string");
    expect(Object.values(kept).some((v) => v instanceof Float32Array)).toBe(
      false,
    );
  });

  it("lights a node for the length of the call and counts it", () => {
    const { tracker, targets } = trackerOnBoard();
    targets.get("a")!({ __internal: { state: "call-process", data: null } });
    expect(tracker.get("a")!.startedAt).toBeDefined();
    expect(tracker.get("a")!.calls).toBe(1);

    targets.get("a")!({
      __internal: { state: "call-process-finished", data: { ok: true } },
    });
    expect(tracker.get("a")!.startedAt).toBeUndefined();
    expect(tracker.get("a")!.litUntil).toBeGreaterThan(performance.now());
    expect(tracker.get("a")!.lastOut!.summary).toBe("object 1");
  });

  it("sends a pulse onward only when something was passed on", () => {
    const { tracker, targets } = trackerOnBoard();

    targets.get("a")!({
      __internal: { state: "call-process-finished", data: { value: 1 } },
    });
    expect(tracker.livePulses(performance.now())).toHaveLength(1);

    targets.get("b")!({
      __internal: { state: "call-process-finished", data: null },
    });
    expect(
      tracker.livePulses(performance.now()).filter((p) => p.from === "b"),
    ).toHaveLength(0);
  });

  it("drops a pulse once it has arrived", () => {
    const { tracker, targets } = trackerOnBoard();
    targets.get("a")!({
      __internal: { state: "call-process-finished", data: 1 },
    });
    const now = performance.now();
    expect(tracker.livePulses(now)).toHaveLength(1);
    expect(tracker.livePulses(now + PULSE_MS + 1)).toHaveLength(0);
  });

  it("ignores notifications a service sends about itself", () => {
    const { tracker, targets } = trackerOnBoard();
    targets.get("a")!({ streamText: "hello" });
    expect(tracker.get("a")).toBeUndefined();
  });

  it("stops listening when detached", () => {
    const { targets, detach } = trackerOnBoard();
    detach();
    expect(targets.size).toBe(0);
  });

  it("reports an idle board as quiet", () => {
    const { tracker, targets } = trackerOnBoard();
    expect(tracker.isQuiet(performance.now())).toBe(true);
    targets.get("a")!({ __internal: { state: "call-process", data: null } });
    expect(tracker.isQuiet(performance.now())).toBe(false);
  });
});

describe("describeResult", () => {
  it("says what a result is without holding on to it", () => {
    expect(describeResult(null)).toBe("null");
    expect(describeResult("abcd")).toBe("string 4");
    expect(describeResult(new Float32Array(8))).toBe("Float32Array 8");
    expect(describeResult([1, 2, 3])).toBe("array 3");
    expect(describeResult({ a: 1, b: 2 })).toBe("object 2");
  });
});
