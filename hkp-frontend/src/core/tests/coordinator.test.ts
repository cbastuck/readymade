import { describe, expect, it } from "vitest";

import { CoordinatorState, createBoardCoordinator } from "../coordinator";

const board = (): CoordinatorState => ({
  services: {
    "chat-node": [
      {
        uuid: "peer-svc",
        state: { __hkpMount: "http://192.168.1.5:8080/hosted/abc123" },
      },
      { uuid: "monitor-svc", state: {} },
    ],
    "chat-browser": [
      {
        uuid: "peer-socket",
        state: { __hkpMount: "hkp-mount://chat-node/peer-svc" },
      },
    ],
  },
});

const coordinatorFor = (state: CoordinatorState = board()) =>
  createBoardCoordinator(() => state);

describe("getServiceState", () => {
  it("reads a service's state from any runtime on the board", () => {
    expect(coordinatorFor().getServiceState("chat-node", "peer-svc")).toEqual({
      __hkpMount: "http://192.168.1.5:8080/hosted/abc123",
    });
  });

  it("is undefined for a runtime or service the board does not have", () => {
    const coordinator = coordinatorFor();
    expect(coordinator.getServiceState("nope", "peer-svc")).toBeUndefined();
    expect(coordinator.getServiceState("chat-node", "nope")).toBeUndefined();
  });

  it("reads current state rather than the state it was created with", () => {
    // Services hold the coordinator for their lifetime, and a board's state is
    // replaced on every update — a captured snapshot would go stale.
    let state: CoordinatorState = { services: {} };
    const coordinator = createBoardCoordinator(() => state);
    expect(coordinator.getServiceState("chat-node", "peer-svc")).toBeUndefined();
    state = board();
    expect(coordinator.getServiceState("chat-node", "peer-svc")).toEqual({
      __hkpMount: "http://192.168.1.5:8080/hosted/abc123",
    });
  });
});

describe("resolveMount", () => {
  it("resolves a reference through the owner's published address", () => {
    expect(
      coordinatorFor().resolveMount("hkp-mount://chat-node/peer-svc"),
    ).toEqual({
      host: "192.168.1.5",
      port: 8080,
      path: "/hosted/abc123",
      secure: false,
    });
  });

  it("takes an already-resolved address as it is", () => {
    // What a consumer holds after export: same field, same call, no reference.
    expect(
      coordinatorFor().resolveMount("http://127.0.0.1:9000/hosted/deadbeef"),
    ).toEqual({
      host: "127.0.0.1",
      port: 9000,
      path: "/hosted/deadbeef",
      secure: false,
    });
  });

  it("resolves to null while the owner has not published yet", () => {
    // Runtimes restore concurrently, so this is a normal transient state the
    // caller retries — not a failure.
    const coordinator = coordinatorFor({
      services: { "chat-node": [{ uuid: "peer-svc", state: {} }] },
    });
    expect(coordinator.resolveMount("hkp-mount://chat-node/peer-svc")).toBeNull();
    expect(coordinator.resolveMountUrl("hkp-mount://chat-node/peer-svc")).toBeNull();
  });

  it("resolves to null for a reference to a runtime this board lacks", () => {
    expect(coordinatorFor().resolveMount("hkp-mount://gone/peer-svc")).toBeNull();
  });

  it("resolves to null without a value", () => {
    expect(coordinatorFor().resolveMount(null)).toBeNull();
  });
});

describe("resolveMountsInBoard", () => {
  it("bakes references into addresses for export", () => {
    const exported: any = coordinatorFor().resolveMountsInBoard({
      services: {
        "chat-browser": [
          {
            uuid: "peer-socket",
            state: { __hkpMount: "hkp-mount://chat-node/peer-svc" },
          },
        ],
      },
    });
    expect(exported.services["chat-browser"][0].state.__hkpMount).toBe(
      "http://192.168.1.5:8080/hosted/abc123",
    );
  });
});
