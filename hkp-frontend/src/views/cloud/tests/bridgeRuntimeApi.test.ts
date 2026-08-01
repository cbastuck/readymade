import { describe, expect, it, vi } from "vitest";

import { createBridgeRuntimeApi } from "../bridgeRuntimeApi";
import { CoordinatorSnapshotStore } from "../coordinatorSnapshot";
import {
  RuntimeDescriptor,
  RuntimeScope,
  ServiceDescriptor,
} from "hkp-frontend/src/types";

/**
 * Reaching a cloud board's runtimes through its coordinator.
 *
 * The browser is a viewer of a board someone else owns, so nothing here may
 * dial a runtime or provision one — that is what lets a cloud board's runtimes
 * live where the browser has no route to them.
 */

const runtime = {
  id: "node",
  name: "Node",
  type: "rest",
  url: "http://unreachable-from-here:8080",
} as RuntimeDescriptor;

const boardServices = [
  { uuid: "http-1", serviceId: "http-server-subservices" },
  { uuid: "mon-1", serviceId: "monitor" },
] as Array<ServiceDescriptor>;

function attached() {
  const snapshot = new CoordinatorSnapshotStore();
  snapshot.apply({
    type: "snapshot",
    seq: 1,
    boardName: "board-1",
    runtimes: [
      {
        runtimeId: "node",
        registry: [{ serviceId: "monitor", serviceName: "Monitor" }],
        services: {
          "http-1": { __hkpMount: "http://127.0.0.1:8080/hosted/abc" },
          "mon-1": { logToConsole: true },
        },
      },
    ],
  });
  const configureRemoteService = vi.fn(async () => ({ logToConsole: false }));
  const api = createBridgeRuntimeApi({ snapshot, configureRemoteService });
  return { api, snapshot, configureRemoteService };
}

describe("restoring an attached runtime", () => {
  it("builds the board from the snapshot without provisioning anything", async () => {
    // No fetch is stubbed: any HTTP call would throw, which is the assertion.
    const { api } = attached();

    const result = await api.restoreRuntime(runtime, boardServices, null, "b");

    expect(result?.runtime.id).toBe("node");
    expect(result?.scope).toBeTruthy();
  });

  it("renders the board's services with the state the coordinator reported", async () => {
    // The board says which services exist and in what order; the coordinator
    // says what each currently reports — including a mount address that no
    // saved board can carry.
    const { api } = attached();

    const result = await api.restoreRuntime(runtime, boardServices, null, "b");

    expect(result?.services.map((svc) => svc.uuid)).toEqual([
      "http-1",
      "mon-1",
    ]);
    expect((result?.services[0] as { state?: unknown }).state).toEqual({
      __hkpMount: "http://127.0.0.1:8080/hosted/abc",
    });
  });

  it("carries the runtime's registry, so panels resolve by version", async () => {
    const { api } = attached();
    const result = await api.restoreRuntime(runtime, boardServices, null, "b");
    expect(result?.registry).toEqual([
      { serviceId: "monitor", serviceName: "Monitor" },
    ]);
  });
});

describe("what a service says", () => {
  it("reaches the panels registered for it", async () => {
    // A Monitor renders its output, and that output is never part of its state
    // — its getState omits it deliberately. So a browser that only saw state
    // would show an empty Monitor on a board that is plainly running.
    const { api } = attached();
    const { scope } = (await api.restoreRuntime(
      runtime,
      boardServices,
      null,
      "b",
    ))!;

    const received: unknown[] = [];
    scope
      .getApp()
      .registerNotificationTarget?.({ uuid: "mon-1" } as never, (payload: unknown) =>
        received.push(payload),
      );

    (scope as unknown as {
      notify: (uuid: string, payload: unknown) => void;
    }).notify("mon-1", { triggerCount: 7 });

    expect(received).toEqual([{ triggerCount: 7 }]);
  });

  it("does not reach panels of other services", async () => {
    const { api } = attached();
    const { scope } = (await api.restoreRuntime(
      runtime,
      boardServices,
      null,
      "b",
    ))!;

    const received: unknown[] = [];
    scope
      .getApp()
      .registerNotificationTarget?.({ uuid: "http-1" } as never, (payload: unknown) =>
        received.push(payload),
      );

    (scope as unknown as {
      notify: (uuid: string, payload: unknown) => void;
    }).notify("mon-1", { triggerCount: 7 });

    expect(received).toEqual([]);
  });
});

describe("acting on an attached board", () => {
  it("configures a service through the coordinator", async () => {
    const { api, configureRemoteService } = attached();
    const { scope } = (await api.restoreRuntime(
      runtime,
      boardServices,
      null,
      "b",
    ))!;
    const onConfig = vi.fn();
    scope.onConfig = onConfig;

    const state = await api.configureService(
      scope,
      { uuid: "mon-1" },
      { logToConsole: false },
    );

    expect(configureRemoteService).toHaveBeenCalledWith("node", "mon-1", {
      logToConsole: false,
    });
    // The panel is handed the resulting state, as the REST api does, so an
    // optimistic control can reconcile.
    expect(onConfig).toHaveBeenCalledWith("mon-1", {
      state: { logToConsole: false },
    });
    expect(state).toEqual({ logToConsole: false });
  });

  it("reads a service's state from the snapshot", async () => {
    const { api } = attached();
    const { scope } = (await api.restoreRuntime(
      runtime,
      boardServices,
      null,
      "b",
    ))!;

    expect(await api.getServiceConfig(scope, { uuid: "mon-1" })).toEqual({
      logToConsole: true,
    });
  });

  it("leaves the board running when the view goes away", async () => {
    // Closing a viewer must not stop a board that belongs to a coordinator.
    const { api } = attached();
    const { scope } = (await api.restoreRuntime(
      runtime,
      boardServices,
      null,
      "b",
    ))!;

    await expect(
      api.removeRuntime(scope, runtime, null),
    ).resolves.toBeUndefined();
  });

  it("refuses structural edits, pointing at where they belong", async () => {
    // Adding a service means owning the board, and a deployed board is owned by
    // its coordinator. Changing it happens where it was built.
    const { api } = attached();
    const scope = {} as RuntimeScope;

    await expect(
      api.addService(scope, { serviceId: "monitor" } as never),
    ).rejects.toThrow(/deploy it again/);
    await expect(api.removeService(scope, { uuid: "mon-1" })).rejects.toThrow(
      /deploy it again/,
    );
    await expect(api.rearrangeServices(scope, [])).rejects.toThrow(
      /deploy it again/,
    );
    await expect(api.processRuntime(scope, {}, null)).rejects.toThrow(
      /deploy it again/,
    );
  });
});
