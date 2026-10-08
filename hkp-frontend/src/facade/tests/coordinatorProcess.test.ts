import { describe, expect, it, vi } from "vitest";

import { findService, processService } from "../boardServices";
import { executeActions } from "../executeActions";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";

/**
 * A facade on a board attached through its coordinator.
 *
 * The browser dials none of that board's runtimes — it may have no route to
 * them, and a member is not even told where they are. So "do this now" has to
 * go the way everything else does, over the bridge, and the coordinator begins
 * the run as whoever it verified. A request the facade wrote itself would
 * bypass the one party that can say who is calling.
 */

function attached(runtime: Record<string, unknown> = {}) {
  const processOverBridge = vi.fn(async () => ({ accepted: true }));
  const configureOverBridge = vi.fn(async () => ({}));
  const context = {
    // What a coordinator's scope is: nothing to look a live service up in, and
    // a marker saying its services are reached through the coordinator.
    scopes: { node: { app: {}, viaCoordinator: true } },
    services: { node: [{ uuid: "book", serviceId: "sql", state: {} }] },
    runtimes: [{ id: "node", name: "Node", type: "rest", ...runtime }],
    runtimeApis: {
      rest: {
        processService: processOverBridge,
        configureService: configureOverBridge,
      },
    },
  } as unknown as BoardContextState;
  return { context, processOverBridge, configureOverBridge };
}

describe("a process action on an attached board", () => {
  it("asks the runtime's api, and dials nothing", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { context, processOverBridge } = attached({
      url: "http://127.0.0.1:8080",
    });

    processService(context, "book", { hour: 10 });

    expect(processOverBridge).toHaveBeenCalledWith(
      context.scopes.node,
      { uuid: "book" },
      { hour: 10 },
    );
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("reaches a service on a runtime it was given no address for", () => {
    // A member's projection: the runtime is named, and not located.
    const { context, processOverBridge } = attached();

    processService(context, "book", { hour: 10 });

    expect(processOverBridge).toHaveBeenCalledOnce();
    expect(findService(context, "book")?.uuid).toBe("book");
  });

  it("still does nothing for a runtime that is neither", () => {
    const { context, processOverBridge } = attached();
    (context.scopes.node as unknown as { viaCoordinator: boolean }).viaCoordinator =
      false;

    processService(context, "book", {});

    expect(processOverBridge).not.toHaveBeenCalled();
    expect(findService(context, "book")).toBeNull();
  });

  it("is where a facade's process action ends up", async () => {
    const { context, processOverBridge } = attached();

    await executeActions({
      actions: [
        { type: "process", serviceUuid: "book", payload: { hour: "$$input" } },
      ],
      value: 11,
      boardContext: context,
      setState: () => {},
    });

    expect(processOverBridge).toHaveBeenCalledWith(
      context.scopes.node,
      { uuid: "book" },
      { hour: 11 },
    );
  });
});

describe("who the facade is being shown to", () => {
  it("is resolved in a payload beside facade state", async () => {
    const { context, processOverBridge } = attached();

    await executeActions({
      actions: [
        {
          type: "process",
          serviceUuid: "book",
          payload: {
            as: { $user: "name" },
            address: { $user: "email" },
            day: { $state: "day" },
          },
        },
      ],
      value: undefined,
      boardContext: context,
      setState: () => {},
      state: { day: "2026-10-05" },
      identity: { email: "anna@example.com", name: "Anna" },
    });

    expect(processOverBridge.mock.calls[0][2]).toEqual({
      as: "Anna",
      address: "anna@example.com",
      day: "2026-10-05",
    });
  });

  it("is nothing where nobody is known", async () => {
    const { context, processOverBridge } = attached();

    await executeActions({
      actions: [
        { type: "process", serviceUuid: "book", payload: { as: { $user: "name" } } },
      ],
      value: undefined,
      boardContext: context,
      setState: () => {},
    });

    expect(processOverBridge.mock.calls[0][2]).toEqual({ as: undefined });
  });
});
