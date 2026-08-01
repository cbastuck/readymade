import { describe, expect, it, vi } from "vitest";

import {
  CoordinatorSnapshotStore,
  SnapshotMessage,
} from "../coordinatorSnapshot";

const snapshot = (seq: number): SnapshotMessage => ({
  type: "snapshot",
  seq,
  boardName: "board-1",
  runtimes: [
    {
      runtimeId: "node",
      registry: [{ serviceId: "map", serviceName: "Map", version: "v1" }],
      services: {
        "http-1": { __hkpMount: "http://127.0.0.1:8080/hosted/abc" },
        "mon-1": { logToConsole: false },
      },
    },
  ],
});

describe("the board a coordinator reports", () => {
  it("is what the browser renders from", () => {
    const store = new CoordinatorSnapshotStore();
    store.apply(snapshot(1));

    expect(store.getBoardName()).toBe("board-1");
    expect(store.getRuntimeIds()).toEqual(["node"]);
    expect(store.getServiceState("node", "http-1")).toEqual({
      __hkpMount: "http://127.0.0.1:8080/hosted/abc",
    });
    // The registry decides which panel a service gets, by id *and* version.
    expect(store.getRegistry("node")).toEqual([
      { serviceId: "map", serviceName: "Map", version: "v1" },
    ]);
  });

  it("takes increments in sequence", () => {
    const store = new CoordinatorSnapshotStore();
    store.apply(snapshot(1));

    const result = store.apply({
      type: "serviceState",
      seq: 2,
      runtimeId: "node",
      serviceUuid: "mon-1",
      state: { logToConsole: true },
    });

    expect(result.needsResync).toBe(false);
    expect(store.getServiceState("node", "mon-1")).toEqual({
      logToConsole: true,
    });
    // Untouched services are left alone.
    expect(store.getServiceState("node", "http-1")).toBeTruthy();
  });

  it("asks to be told again when it misses one", () => {
    // Carrying on from a gap would render state that never existed.
    const store = new CoordinatorSnapshotStore();
    store.apply(snapshot(1));

    const result = store.apply({
      type: "serviceState",
      seq: 4, // 2 and 3 never arrived
      runtimeId: "node",
      serviceUuid: "mon-1",
      state: { logToConsole: true },
    });

    expect(result.needsResync).toBe(true);
    expect(store.getServiceState("node", "mon-1")).toEqual({
      logToConsole: false,
    });
  });

  it("asks to be told again about a runtime it has never heard of", () => {
    const store = new CoordinatorSnapshotStore();
    store.apply(snapshot(1));

    expect(
      store.apply({
        type: "serviceState",
        seq: 2,
        runtimeId: "elsewhere",
        serviceUuid: "svc",
        state: {},
      }).needsResync,
    ).toBe(true);
  });

  it("replaces everything when a fresh snapshot arrives", () => {
    // What a resync is for: start from the board as it is, not from a patched
    // version of what it used to be.
    const store = new CoordinatorSnapshotStore();
    store.apply(snapshot(1));
    store.apply({
      type: "snapshot",
      seq: 9,
      boardName: "board-1",
      runtimes: [{ runtimeId: "node", registry: [], services: { "mon-1": {} } }],
    });

    expect(store.getServiceState("node", "http-1")).toBeUndefined();
    expect(store.getRuntimeIds()).toEqual(["node"]);
  });

  it("tells subscribers when it changed", () => {
    const store = new CoordinatorSnapshotStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.apply(snapshot(1));
    expect(listener).toHaveBeenCalledTimes(1);

    // A rejected increment changed nothing, so nothing is announced.
    store.apply({
      type: "serviceState",
      seq: 7,
      runtimeId: "node",
      serviceUuid: "mon-1",
      state: {},
    });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.apply(snapshot(2));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("resolving mounts against what the coordinator reported", () => {
  it("reads as the shape a board coordinator expects", () => {
    // So a browser service's hkp-mount:// reference resolves to the address the
    // remote runtime published, which no saved board can carry.
    const store = new CoordinatorSnapshotStore();
    store.apply(snapshot(1));

    expect(store.asCoordinatorState()).toEqual({
      services: {
        node: [
          {
            uuid: "http-1",
            state: { __hkpMount: "http://127.0.0.1:8080/hosted/abc" },
          },
          { uuid: "mon-1", state: { logToConsole: false } },
        ],
      },
    });
  });
});
