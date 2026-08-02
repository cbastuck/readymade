import { describe, expect, it, vi } from "vitest";

import { createBridgeRuntimeApi } from "../bridgeRuntimeApi";
import { CoordinatorSnapshotStore } from "../coordinatorSnapshot";
import { RuntimeDescriptor, RuntimeScope, ServiceDescriptor } from "hkp-frontend/src/types";

/**
 * Opening a board that has been stopped.
 *
 * Stopping keeps the board and its config — only the runtimes go. So the board
 * still renders every service it has, and the coordinator holds state for none
 * of them. Panels read that state and reach into it, so "no state" has to
 * arrive as an empty configuration rather than as nothing at all.
 */

const runtime = {
  id: "node",
  name: "Node",
  type: "rest",
  url: "http://unreachable-from-here:8080",
} as RuntimeDescriptor;

const boardServices = [
  { uuid: "timer-1", serviceId: "timer" },
  { uuid: "mon-1", serviceId: "monitor" },
] as Array<ServiceDescriptor>;

/** What a coordinator sends once a board is stopped: the config, no runtimes. */
function stopped() {
  const snapshot = new CoordinatorSnapshotStore();
  snapshot.apply({
    type: "snapshot",
    seq: 1,
    boardName: "board-1",
    status: "stopped",
    config: {
      boardName: "board-1",
      runtimes: [runtime],
      services: { node: boardServices },
    },
    runtimes: [],
  });
  return createBridgeRuntimeApi({
    snapshot,
    configureRemoteService: vi.fn(async () => ({})),
  });
}

describe("a service on a stopped board", () => {
  it("reports an empty configuration rather than nothing", async () => {
    const api = stopped();
    const scope = { descriptor: runtime } as RuntimeScope;

    expect(await api.getServiceConfig(scope, { uuid: "mon-1" })).toEqual({});
  });

  it("still builds the board, so the user can see what it is", async () => {
    const api = stopped();

    const result = await api.restoreRuntime(runtime, boardServices, null, "b");

    expect(result?.services.map((svc) => svc.uuid)).toEqual([
      "timer-1",
      "mon-1",
    ]);
  });
});
