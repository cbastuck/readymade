import { describe, expect, it, vi } from "vitest";

import { createObservedRuntimeApi } from "../observedRuntimeApi";
import { RuntimeApi, RuntimeScope } from "hkp-frontend/src/types";

/**
 * Watching a runtime on a remote server.
 *
 * The server records no attribution, so this browser cannot know who owns the
 * runtime and must never act as if it did. Everything that would change what
 * the runtime is has to be refused — and, less obviously, leaving must not tear
 * it down: the standard teardown deletes the runtime on the server, which would
 * stop a board belonging to someone else.
 */

function baseApi(): RuntimeApi {
  return {
    addRuntime: vi.fn(async () => null),
    restoreRuntime: vi.fn(async () => null),
    removeRuntime: vi.fn(async () => {}),
    processRuntime: vi.fn(async () => {}),
    addService: vi.fn(async () => null),
    removeService: vi.fn(async () => null),
    configureService: vi.fn(async () => ({ configured: true })),
    getServiceConfig: vi.fn(async () => ({ read: true })),
    processService: vi.fn(async () => {}),
    rearrangeServices: vi.fn(async () => []),
  };
}

describe("an observed remote runtime", () => {
  it("refuses everything structural", async () => {
    const base = baseApi();
    const api = createObservedRuntimeApi(base);
    const scope = {} as RuntimeScope;

    await expect(api.addRuntime({} as never, null)).rejects.toThrow(/provision/);
    await expect(api.addService(scope, {} as never)).rejects.toThrow(/add a service/);
    await expect(api.removeService(scope, { uuid: "svc" })).rejects.toThrow(
      /remove a service/,
    );
    await expect(api.rearrangeServices(scope, [])).rejects.toThrow(/reorder/);

    expect(base.addRuntime).not.toHaveBeenCalled();
    expect(base.addService).not.toHaveBeenCalled();
    expect(base.removeService).not.toHaveBeenCalled();
    expect(base.rearrangeServices).not.toHaveBeenCalled();
  });

  it("refuses to run it, since the result belongs to someone else's board", async () => {
    const base = baseApi();
    const api = createObservedRuntimeApi(base);
    const scope = {} as RuntimeScope;

    await expect(api.processRuntime(scope, {}, null)).rejects.toThrow(/run a runtime/);
    await expect(api.processService(scope, { uuid: "svc" }, {})).rejects.toThrow(
      /run a service/,
    );

    expect(base.processRuntime).not.toHaveBeenCalled();
    expect(base.processService).not.toHaveBeenCalled();
  });

  it("configures a service, which is what a runtime exists to be told", async () => {
    const base = baseApi();
    const api = createObservedRuntimeApi(base);
    const scope = {} as RuntimeScope;

    expect(await api.configureService(scope, { uuid: "mon-1" }, { on: true })).toEqual({
      configured: true,
    });
    expect(await api.getServiceConfig(scope, { uuid: "mon-1" })).toEqual({
      read: true,
    });
  });

  it("lets go of the runtime instead of deleting it", async () => {
    const base = baseApi();
    const api = createObservedRuntimeApi(base);
    const close = vi.fn(async () => {});
    const scope = { close } as unknown as RuntimeScope;

    await api.removeRuntime(scope, {} as never, null);

    expect(close).toHaveBeenCalledOnce();
    expect(base.removeRuntime).not.toHaveBeenCalled();
  });
});
