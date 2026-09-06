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

function trackerOnBoard() {
  const targets = new Map<string, (n: any) => void>();
  const app = {
    registerNotificationTarget: (svc: any, cb: any) =>
      targets.set(svc.uuid, cb),
    unregisterNotificationTarget: (svc: any) => targets.delete(svc.uuid),
  };
  const scopes = { ui: { getApp: () => app } } as any;

  const scene = buildScene(runtimes, services);
  const tracker = new ActivityTracker();
  const detach = tracker.attach(scene.nodes, scene.edges, scopes);
  return { tracker, targets, detach };
}

describe("ActivityTracker", () => {
  it("registers for every service, including ones with no panel on screen", () => {
    const { targets } = trackerOnBoard();
    expect([...targets.keys()].sort()).toEqual(["a", "b"]);
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
