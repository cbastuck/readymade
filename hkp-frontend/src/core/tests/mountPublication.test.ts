import { describe, expect, it } from "vitest";

import { createBoardCoordinator } from "../coordinator";
import {
  configureKey,
  pendingMountConfigures,
} from "../mountPublication";

const isRemote = (type: string) => type !== "browser";

const board = () => ({
  runtimes: [
    { id: "endpoint-node", type: "rest" },
    { id: "caller-node", type: "rest" },
    { id: "ui", type: "browser" },
  ],
  services: {
    "endpoint-node": [
      {
        uuid: "echo-server",
        state: { __hkpMount: "http://127.0.0.1:8080/hosted/abc123" },
      },
    ],
    "caller-node": [
      {
        uuid: "call",
        state: { __hkpMount: "hkp-mount://endpoint-node/echo-server" },
      },
    ],
    ui: [
      {
        uuid: "peer-socket",
        state: { __hkpMount: "hkp-mount://endpoint-node/echo-server" },
      },
    ],
  },
});

const coordinatorFor = (state = board()) =>
  createBoardCoordinator(() => state);

describe("pendingMountConfigures", () => {
  it("hands a remote consumer the address its reference names", () => {
    expect(
      pendingMountConfigures(board(), coordinatorFor(), new Map(), isRemote),
    ).toEqual([
      {
        runtimeId: "caller-node",
        serviceUuid: "call",
        url: "http://127.0.0.1:8080/hosted/abc123",
      },
    ]);
  });

  it("leaves services this browser hosts alone", () => {
    // They hold the coordinator already and resolve on demand, so pushing to
    // them would be redundant — and there is no configure round trip to make.
    const pending = pendingMountConfigures(
      board(),
      coordinatorFor(),
      new Map(),
      isRemote,
    );
    expect(pending.some((p) => p.runtimeId === "ui")).toBe(false);
  });

  it("waits while the owner has not published an address", () => {
    // Runtimes restore concurrently, so this is the normal state at load.
    const unpublished = board();
    unpublished.services["endpoint-node"][0].state = { __hkpMount: "" };
    expect(
      pendingMountConfigures(
        unpublished,
        coordinatorFor(unpublished),
        new Map(),
        isRemote,
      ),
    ).toEqual([]);
  });

  it("does not re-send an address a service already has", () => {
    // Board state changes constantly; only mount changes should cause traffic.
    const sent = new Map([
      [
        configureKey("caller-node", "call"),
        "http://127.0.0.1:8080/hosted/abc123",
      ],
    ]);
    expect(
      pendingMountConfigures(board(), coordinatorFor(), sent, isRemote),
    ).toEqual([]);
  });

  it("sends again when the address changes", () => {
    // A runtime that restarted assigns a new path; the old one is dead.
    const sent = new Map([
      [configureKey("caller-node", "call"), "http://127.0.0.1:8080/hosted/old"],
    ]);
    expect(
      pendingMountConfigures(board(), coordinatorFor(), sent, isRemote),
    ).toHaveLength(1);
  });

  it("ignores a service already holding an address", () => {
    const resolved = board();
    resolved.services["caller-node"][0].state = {
      __hkpMount: "http://127.0.0.1:8080/hosted/abc123",
    };
    expect(
      pendingMountConfigures(
        resolved,
        coordinatorFor(resolved),
        new Map(),
        isRemote,
      ),
    ).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// One job each: the reference is authored, the address is a runtime fact.
// ──────────────────────────────────────────────────────────────────────────────

describe("the two fields", () => {
  const split = () => ({
    runtimes: [
      { id: "endpoint-node", type: "rest" },
      { id: "caller-node", type: "rest" },
    ],
    services: {
      "endpoint-node": [
        {
          uuid: "echo-server",
          state: { __hkpMount: "http://127.0.0.1:8080/hosted/abc123" },
        },
      ],
      "caller-node": [
        { uuid: "call", state: { url: "hkp-mount://endpoint-node/echo-server" } },
      ],
    },
  });

  it("resolves a reference written in the service's own field", () => {
    const state = split();
    const pending = pendingMountConfigures(
      state,
      createBoardCoordinator(() => state),
      new Map(),
      isRemote,
    );
    expect(pending).toEqual([
      {
        runtimeId: "caller-node",
        serviceUuid: "call",
        url: "http://127.0.0.1:8080/hosted/abc123",
      },
    ]);
  });

  it("hands over nothing once the consumer already reports the address", () => {
    // The configure landed and the state came back. Re-sending it would be
    // churn, and the `sent` map alone cannot say so after a reload.
    const state = split();
    (state.services["caller-node"][0].state as Record<string, unknown>)[
      "__hkpMount"
    ] = "http://127.0.0.1:8080/hosted/abc123";

    expect(
      pendingMountConfigures(
        state,
        createBoardCoordinator(() => state),
        new Map(),
        isRemote,
      ),
    ).toEqual([]);
  });

  it("hands over again when the address changes", () => {
    // A runtime that restarted on another port is still the same mount, and a
    // consumer holding the old address is calling nothing.
    const state = split();
    const sent = new Map([
      [configureKey("caller-node", "call"), "http://127.0.0.1:9999/hosted/old"],
    ]);

    const pending = pendingMountConfigures(
      state,
      createBoardCoordinator(() => state),
      sent,
      isRemote,
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].url).toBe("http://127.0.0.1:8080/hosted/abc123");
  });

  it("finds a reference nested in a sub-pipeline", () => {
    const state = split();
    state.services["caller-node"][0].state = {
      pipeline: [
        {
          instanceId: "inner",
          state: { url: "hkp-mount://endpoint-node/echo-server" },
        },
      ],
    } as never;

    expect(
      pendingMountConfigures(
        state,
        createBoardCoordinator(() => state),
        new Map(),
        isRemote,
      ),
    ).toHaveLength(1);
  });
});
