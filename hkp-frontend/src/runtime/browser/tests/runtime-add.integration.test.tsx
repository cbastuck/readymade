import React, { useContext, useEffect } from "react";
import { describe, it, expect, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";

import BoardProvider, {
  BoardCtx,
  BoardContextState,
} from "hkp-frontend/src/BoardContext";
import { RuntimeApiMap, RuntimeClass } from "hkp-frontend/src/types";

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

describe("runtime add integration", () => {
  it("addRuntime appends runtime with scope, registry, and empty services", async () => {
    const createdRuntime = {
      id: "rt-added-1",
      name: "Browser Runtime",
      type: "browser",
    } as any;
    const createdScope = { marker: "scope-1" } as any;
    const createdRegistry = [
      { serviceId: "hookup.to/service/input", serviceName: "Input" },
    ];

    const browserApi = {
      addRuntime: vi.fn(async () => ({
        runtime: createdRuntime,
        services: [],
        registry: createdRegistry,
        scope: createdScope,
      })),
      removeRuntime: vi.fn(async () => {}),
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
      browser: browserApi,
    };

    let latestCtx: BoardContextState | null = null;

    render(
      <BoardProvider
        user={null}
        boardName="test-board"
        runtimeApis={runtimeApis}
        onRemoveRuntime={vi.fn(async () => {})}
      >
        <ContextProbe onChange={(ctx) => (latestCtx = ctx)} />
      </BoardProvider>,
    );

    await waitFor(() => {
      expect(latestCtx).toBeTruthy();
    });

    const rtClass: RuntimeClass = {
      name: "Browser Runtime",
      type: "browser",
      color: "#abc",
    };

    await act(async () => {
      await latestCtx!.addRuntime(rtClass);
    });

    expect(browserApi.addRuntime).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(latestCtx!.runtimes).toHaveLength(1);
    });

    expect(latestCtx!.runtimes[0].id).toBe(createdRuntime.id);
    expect(latestCtx!.services[createdRuntime.id]).toEqual([]);
    expect(latestCtx!.registry[createdRuntime.id]).toEqual(createdRegistry);
    expect(latestCtx!.scopes[createdRuntime.id]).toBe(createdScope);
  });

  it("addRuntime keeps existing runtimes and appends new runtime", async () => {
    const addRuntimeMock = vi
      .fn()
      .mockResolvedValueOnce({
        runtime: { id: "rt-1", name: "Runtime 1", type: "browser" },
        services: [],
        registry: [],
        scope: { id: "scope-1" },
      })
      .mockResolvedValueOnce({
        runtime: { id: "rt-2", name: "Runtime 2", type: "browser" },
        services: [],
        registry: [],
        scope: { id: "scope-2" },
      });

    const browserApi = {
      addRuntime: addRuntimeMock,
      removeRuntime: vi.fn(async () => {}),
      restoreRuntime: vi.fn(),
      processRuntime: vi.fn(),
      addService: vi.fn(),
      removeService: vi.fn(),
      configureService: vi.fn(),
      getServiceConfig: vi.fn(),
      processService: vi.fn(),
      rearrangeServices: vi.fn(),
    } as any;

    const runtimeApis: RuntimeApiMap = { browser: browserApi };
    let latestCtx: BoardContextState | null = null;

    render(
      <BoardProvider
        user={null}
        boardName="test-board"
        runtimeApis={runtimeApis}
        onRemoveRuntime={vi.fn(async () => {})}
      >
        <ContextProbe onChange={(ctx) => (latestCtx = ctx)} />
      </BoardProvider>,
    );

    await waitFor(() => expect(latestCtx).toBeTruthy());

    const rtClass: RuntimeClass = {
      name: "Browser Runtime",
      type: "browser",
    };

    await act(async () => {
      await latestCtx!.addRuntime(rtClass);
      await latestCtx!.addRuntime(rtClass);
    });

    await waitFor(() => {
      expect(latestCtx!.runtimes.map((r) => r.id)).toEqual(["rt-1", "rt-2"]);
    });
  });

  it("addRuntime null result does not partially mutate board state", async () => {
    const browserApi = {
      addRuntime: vi.fn(async () => null),
      removeRuntime: vi.fn(async () => {}),
      restoreRuntime: vi.fn(),
      processRuntime: vi.fn(),
      addService: vi.fn(),
      removeService: vi.fn(),
      configureService: vi.fn(),
      getServiceConfig: vi.fn(),
      processService: vi.fn(),
      rearrangeServices: vi.fn(),
    } as any;

    const runtimeApis: RuntimeApiMap = { browser: browserApi };
    let latestCtx: BoardContextState | null = null;
    render(
      <BoardProvider
        user={null}
        boardName="test-board"
        runtimeApis={runtimeApis}
        onRemoveRuntime={vi.fn(async () => {})}
      >
        <ContextProbe onChange={(ctx) => (latestCtx = ctx)} />
      </BoardProvider>,
    );

    await waitFor(() => expect(latestCtx).toBeTruthy());

    await act(async () => {
      await latestCtx!.addRuntime({ name: "Browser Runtime", type: "browser" });
    });

    expect(latestCtx!.runtimes).toHaveLength(0);
    expect(Object.keys(latestCtx!.services)).toHaveLength(0);
    expect(Object.keys(latestCtx!.registry)).toHaveLength(0);
    expect(Object.keys(latestCtx!.scopes)).toHaveLength(0);
  });

  it("added runtime can be processed via board runtime api/scope wiring", async () => {
    const scopeObj = { id: "scope-process" } as any;
    const processRuntimeSpy = vi.fn(async (_scope: any, params: any) => params);

    const browserApi = {
      addRuntime: vi.fn(async () => ({
        runtime: { id: "rt-proc", name: "Runtime Proc", type: "browser" },
        services: [],
        registry: [],
        scope: scopeObj,
      })),
      processRuntime: processRuntimeSpy,
      removeRuntime: vi.fn(async () => {}),
      restoreRuntime: vi.fn(),
      addService: vi.fn(),
      removeService: vi.fn(),
      configureService: vi.fn(),
      getServiceConfig: vi.fn(),
      processService: vi.fn(),
      rearrangeServices: vi.fn(),
    } as any;

    const runtimeApis: RuntimeApiMap = { browser: browserApi };
    let latestCtx: BoardContextState | null = null;

    render(
      <BoardProvider
        user={null}
        boardName="test-board"
        runtimeApis={runtimeApis}
        onRemoveRuntime={vi.fn(async () => {})}
      >
        <ContextProbe onChange={(ctx) => (latestCtx = ctx)} />
      </BoardProvider>,
    );

    await waitFor(() => {
      expect(latestCtx).toBeTruthy();
    });

    await act(async () => {
      await latestCtx!.addRuntime({ name: "Browser Runtime", type: "browser" });
    });

    await waitFor(() => {
      expect(latestCtx!.runtimes).toHaveLength(1);
    });

    const runtime = latestCtx!.runtimes[0];
    const scope = latestCtx!.scopes[runtime.id];
    const api = latestCtx!.runtimeApis[runtime.type];

    await act(async () => {
      await api.processRuntime(scope, { hello: "world" }, null);
    });

    expect(processRuntimeSpy).toHaveBeenCalledWith(
      scopeObj,
      { hello: "world" },
      null,
    );
  });
});
