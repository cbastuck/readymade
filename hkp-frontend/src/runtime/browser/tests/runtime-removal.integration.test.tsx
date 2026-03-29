import React, { useContext, useEffect } from "react";
import { describe, it, expect, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";

import BoardProvider, {
  BoardCtx,
  BoardContextState,
} from "hkp-frontend/src/BoardContext";
import BrowserRuntimeScope from "hkp-frontend/src/runtime/browser/BrowserRuntimeScope";
import { RuntimeApiMap, RuntimeDescriptor } from "hkp-frontend/src/types";

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function ContextProbe({
  onChange,
}: {
  onChange: (ctx: BoardContextState | null) => void;
}) {
  const ctx = useContext(BoardCtx);
  useEffect(() => {
    onChange(ctx);
  }, [ctx, onChange]);
  return null;
}

describe("runtime removal integration", () => {
  it("removeRuntime should not update board state before runtime API removeRuntime resolves", async () => {
    const deferred = createDeferred<void>();

    const runtime: RuntimeDescriptor = {
      id: "rt-remote-1",
      name: "Remote Runtime",
      type: "remote",
      url: "https://example-runtime.local",
    };

    const api = {
      removeRuntime: vi.fn(() => deferred.promise),
      addRuntime: vi.fn(),
      restoreRuntime: vi.fn(),
      processRuntime: vi.fn(),
      addService: vi.fn(),
      removeService: vi.fn(),
      configureService: vi.fn(),
      getServiceConfig: vi.fn(),
      processService: vi.fn(),
      rearrangeServices: vi.fn(),
    } as any;

    const runtimeApis: RuntimeApiMap = {
      remote: api,
    };

    let latestCtx: BoardContextState | null = null;

    render(
      <BoardProvider
        user={null}
        boardName="test-board"
        runtimeApis={runtimeApis}
        onRemoveRuntime={vi.fn(async () => {})}
        initialState={{
          runtimes: [runtime],
          services: { [runtime.id]: [] },
          scopes: { [runtime.id]: {} as any },
          registry: { [runtime.id]: [] },
        }}
      >
        <ContextProbe onChange={(ctx) => (latestCtx = ctx)} />
      </BoardProvider>,
    );

    await waitFor(() => {
      expect(latestCtx).toBeTruthy();
    });

    let removePromise: Promise<void>;
    await act(async () => {
      removePromise = latestCtx!.removeRuntime(runtime);
    });

    await waitFor(() => {
      expect(api.removeRuntime).toHaveBeenCalledTimes(1);
    });

    // Expected behavior: state must still contain the runtime until removeRuntime resolves.
    expect(latestCtx!.runtimes.some((x) => x.id === runtime.id)).toBe(true);

    await act(async () => {
      deferred.resolve();
      await removePromise!;
    });
  });

  it("removeRuntime should remove scope and registry entries for removed runtime", async () => {
    const runtime: RuntimeDescriptor = {
      id: "rt-browser-1",
      name: "Browser Runtime",
      type: "browser",
    };

    const api = {
      removeRuntime: vi.fn(async () => {}),
      addRuntime: vi.fn(),
      restoreRuntime: vi.fn(),
      processRuntime: vi.fn(),
      addService: vi.fn(),
      removeService: vi.fn(),
      configureService: vi.fn(),
      getServiceConfig: vi.fn(),
      processService: vi.fn(),
      rearrangeServices: vi.fn(),
    } as any;

    const runtimeApis: RuntimeApiMap = {
      browser: api,
    };

    let latestCtx: BoardContextState | null = null;

    render(
      <BoardProvider
        user={null}
        boardName="test-board"
        runtimeApis={runtimeApis}
        onRemoveRuntime={vi.fn(async () => {})}
        initialState={{
          runtimes: [runtime],
          services: { [runtime.id]: [] },
          scopes: { [runtime.id]: {} as any },
          registry: { [runtime.id]: [{ serviceId: "x", serviceName: "x" }] },
        }}
      >
        <ContextProbe onChange={(ctx) => (latestCtx = ctx)} />
      </BoardProvider>,
    );

    await waitFor(() => {
      expect(latestCtx).toBeTruthy();
    });

    await act(async () => {
      await latestCtx!.removeRuntime(runtime);
    });

    await waitFor(() => {
      expect(latestCtx!.runtimes).toHaveLength(0);
    });

    expect(latestCtx!.scopes[runtime.id]).toBeUndefined();
    expect(latestCtx!.registry[runtime.id]).toBeUndefined();
  });

  it("BrowserRuntimeScope.removeService should remove destroyed subservices from subservice map", async () => {
    const runtime: RuntimeDescriptor = {
      id: "rt-browser-cleanup",
      name: "Browser Runtime",
      type: "browser",
    };

    const scope = new BrowserRuntimeScope(runtime, {} as any);

    const parent = {
      uuid: "parent-1",
      serviceId: "hookup.to/service/stack",
      serviceName: "Stack",
      board: "test-board",
      app: scope.app,
      process: vi.fn(async (x) => x),
      configure: vi.fn(),
      destroy: vi.fn(async () => {}),
    } as any;

    const childA = {
      uuid: "child-a",
      board: "test-board",
      app: scope.app,
      process: vi.fn(async (x) => x),
      configure: vi.fn(),
      destroy: vi.fn(async () => {}),
    } as any;

    const childB = {
      uuid: "child-b",
      board: "test-board",
      app: scope.app,
      process: vi.fn(async (x) => x),
      configure: vi.fn(),
      destroy: vi.fn(async () => {}),
    } as any;

    scope.serviceInstances = [parent];
    scope.subservices = {
      [childA.uuid]: { service: childA, parent },
      [childB.uuid]: { service: childB, parent },
    };

    await scope.removeService(parent);

    expect(parent.destroy).toHaveBeenCalledTimes(1);
    expect(childA.destroy).toHaveBeenCalledTimes(1);
    expect(childB.destroy).toHaveBeenCalledTimes(1);

    expect(scope.subservices[childA.uuid]).toBeUndefined();
    expect(scope.subservices[childB.uuid]).toBeUndefined();
  });

  it("remote runtime removal failure should prevent local runtime detachment", async () => {
    const runtime: RuntimeDescriptor = {
      id: "rt-remote-fail-1",
      name: "Remote Runtime",
      type: "remote",
      url: "https://example-runtime.local",
    };

    const api = {
      removeRuntime: vi.fn(async () => {
        throw new Error("Remote deletion failed");
      }),
      addRuntime: vi.fn(),
      restoreRuntime: vi.fn(),
      processRuntime: vi.fn(),
      addService: vi.fn(),
      removeService: vi.fn(),
      configureService: vi.fn(),
      getServiceConfig: vi.fn(),
      processService: vi.fn(),
      rearrangeServices: vi.fn(),
    } as any;

    const runtimeApis: RuntimeApiMap = {
      remote: api,
    };

    let latestCtx: BoardContextState | null = null;

    render(
      <BoardProvider
        user={null}
        boardName="test-board"
        runtimeApis={runtimeApis}
        onRemoveRuntime={vi.fn(async () => {})}
        initialState={{
          runtimes: [runtime],
          services: { [runtime.id]: [] },
          scopes: { [runtime.id]: {} as any },
          registry: { [runtime.id]: [] },
        }}
      >
        <ContextProbe onChange={(ctx) => (latestCtx = ctx)} />
      </BoardProvider>,
    );

    await waitFor(() => {
      expect(latestCtx).toBeTruthy();
    });

    await act(async () => {
      await expect(latestCtx!.removeRuntime(runtime)).rejects.toThrow(
        "Remote deletion failed",
      );
    });

    // If remote deletion failed, runtime should remain attached locally.
    expect(latestCtx!.runtimes.some((x) => x.id === runtime.id)).toBe(true);
  });

  it("removing one runtime keeps other runtimes and their services intact", async () => {
    const runtimeA: RuntimeDescriptor = {
      id: "rt-a",
      name: "Browser A",
      type: "browser",
    };
    const runtimeB: RuntimeDescriptor = {
      id: "rt-b",
      name: "Browser B",
      type: "browser",
    };

    const api = {
      removeRuntime: vi.fn(async () => {}),
      addRuntime: vi.fn(),
      restoreRuntime: vi.fn(),
      processRuntime: vi.fn(),
      addService: vi.fn(),
      removeService: vi.fn(),
      configureService: vi.fn(),
      getServiceConfig: vi.fn(),
      processService: vi.fn(),
      rearrangeServices: vi.fn(),
    } as any;

    const runtimeApis: RuntimeApiMap = {
      browser: api,
    };

    let latestCtx: BoardContextState | null = null;

    render(
      <BoardProvider
        user={null}
        boardName="test-board"
        runtimeApis={runtimeApis}
        onRemoveRuntime={vi.fn(async () => {})}
        initialState={{
          runtimes: [runtimeA, runtimeB],
          services: {
            [runtimeA.id]: [
              {
                uuid: "svc-a1",
                serviceId: "hookup.to/service/input",
                serviceName: "Input A",
              },
            ],
            [runtimeB.id]: [
              {
                uuid: "svc-b1",
                serviceId: "hookup.to/service/output",
                serviceName: "Output B",
              },
            ],
          },
          scopes: {
            [runtimeA.id]: {} as any,
            [runtimeB.id]: {} as any,
          },
          registry: {
            [runtimeA.id]: [{ serviceId: "x", serviceName: "x" }],
            [runtimeB.id]: [{ serviceId: "y", serviceName: "y" }],
          },
        }}
      >
        <ContextProbe onChange={(ctx) => (latestCtx = ctx)} />
      </BoardProvider>,
    );

    await waitFor(() => {
      expect(latestCtx).toBeTruthy();
    });

    await act(async () => {
      await latestCtx!.removeRuntime(runtimeA);
    });

    await waitFor(() => {
      expect(latestCtx!.runtimes.map((r) => r.id)).toEqual([runtimeB.id]);
    });

    expect(latestCtx!.services[runtimeA.id]).toBeUndefined();
    expect(latestCtx!.services[runtimeB.id]).toHaveLength(1);
    expect(latestCtx!.scopes[runtimeA.id]).toBeUndefined();
    expect(latestCtx!.scopes[runtimeB.id]).toBeDefined();
    expect(latestCtx!.registry[runtimeA.id]).toBeUndefined();
    expect(latestCtx!.registry[runtimeB.id]).toBeDefined();
  });

  it("removeRuntime targets the correct runtime API and scope when multiple runtimes exist", async () => {
    const runtimeA: RuntimeDescriptor = {
      id: "rt-remote-a",
      name: "Remote A",
      type: "remote",
      url: "https://remote-a.local",
    };
    const runtimeB: RuntimeDescriptor = {
      id: "rt-browser-b",
      name: "Browser B",
      type: "browser",
    };

    const remoteScope = { id: "scope-remote-a" } as any;
    const browserScope = { id: "scope-browser-b" } as any;

    const remoteApi = {
      removeRuntime: vi.fn(async () => {}),
      addRuntime: vi.fn(),
      restoreRuntime: vi.fn(),
      processRuntime: vi.fn(),
      addService: vi.fn(),
      removeService: vi.fn(),
      configureService: vi.fn(),
      getServiceConfig: vi.fn(),
      processService: vi.fn(),
      rearrangeServices: vi.fn(),
    } as any;

    const browserApi = {
      removeRuntime: vi.fn(async () => {}),
      addRuntime: vi.fn(),
      restoreRuntime: vi.fn(),
      processRuntime: vi.fn(),
      addService: vi.fn(),
      removeService: vi.fn(),
      configureService: vi.fn(),
      getServiceConfig: vi.fn(),
      processService: vi.fn(),
      rearrangeServices: vi.fn(),
    } as any;

    const runtimeApis: RuntimeApiMap = {
      remote: remoteApi,
      browser: browserApi,
    };

    let latestCtx: BoardContextState | null = null;

    render(
      <BoardProvider
        user={null}
        boardName="test-board"
        runtimeApis={runtimeApis}
        onRemoveRuntime={vi.fn(async () => {})}
        initialState={{
          runtimes: [runtimeA, runtimeB],
          services: { [runtimeA.id]: [], [runtimeB.id]: [] },
          scopes: {
            [runtimeA.id]: remoteScope,
            [runtimeB.id]: browserScope,
          },
          registry: { [runtimeA.id]: [], [runtimeB.id]: [] },
        }}
      >
        <ContextProbe onChange={(ctx) => (latestCtx = ctx)} />
      </BoardProvider>,
    );

    await waitFor(() => {
      expect(latestCtx).toBeTruthy();
    });

    await act(async () => {
      await latestCtx!.removeRuntime(runtimeA);
    });

    expect(remoteApi.removeRuntime).toHaveBeenCalledTimes(1);
    expect(remoteApi.removeRuntime).toHaveBeenCalledWith(
      remoteScope,
      runtimeA,
      null,
    );
    expect(browserApi.removeRuntime).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(latestCtx!.runtimes.map((r) => r.id)).toEqual([runtimeB.id]);
    });
  });
});
