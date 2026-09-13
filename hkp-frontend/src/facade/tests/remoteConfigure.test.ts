import { describe, expect, it, vi } from "vitest";

import { BoardContextState } from "../../BoardContext";
import { findService } from "../boardServices";

/**
 * A facade widget configuring a service on a remote runtime must go through
 * that runtime's API and not a request of its own: the API is what pushes the
 * secrets a configuration names, and what feeds the answered state back onto
 * the board (`scope.onConfig`) — which is what the service's panel renders. A
 * POST written here would leave the panel showing the state the board loaded
 * with while the runtime had moved on.
 */
function makeContext(configureService: any) {
  return {
    runtimes: [{ id: "node", name: "Node", type: "rest", url: "http://x" }],
    services: {
      node: [
        {
          uuid: "filesystem-svc",
          serviceId: "filesystem",
          serviceName: "Filesystem",
          state: { path: "/tmp/default" },
        },
      ],
    },
    scopes: { node: { app: {}, authenticatedUser: null } },
    registry: { node: [] },
    runtimeApis: { rest: { configureService } },
  } as unknown as BoardContextState;
}

describe("findService on a remote runtime", () => {
  it("configures through the runtime API", async () => {
    const configureService = vi.fn(async () => ({ path: "/tmp/chosen" }));
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const context = makeContext(configureService);

    const service = findService(context, "filesystem-svc");
    await service!.configure({ path: "/tmp/chosen" });

    expect(configureService).toHaveBeenCalledTimes(1);
    const [scope, instance, config] = configureService.mock.calls[0] as any;
    expect(scope).toBe(context.scopes["node"]);
    expect(instance).toEqual({ uuid: "filesystem-svc" });
    expect(config).toEqual({ path: "/tmp/chosen" });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("finds nothing when no API can reach the runtime's class", () => {
    const context = makeContext(vi.fn());
    (context as any).runtimeApis = {};

    expect(findService(context, "filesystem-svc")).toBeNull();
  });
});
