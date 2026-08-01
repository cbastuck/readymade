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
