import React, { useContext, useEffect } from "react";
import { describe, it, expect, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";

import BoardProvider, {
  BoardCtx,
  BoardContextState,
} from "../../../BoardContext";
import {
  RuntimeApiMap,
  RuntimeConfiguration,
  RuntimeDescriptor,
  ServiceDescriptor,
} from "../../../types";

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

describe("runtime update identity integration", () => {
  it("updateRuntime with same runtime id reconfigures existing scope and keeps scope identity", async () => {
    const runtime: RuntimeDescriptor = {
      id: "rt-browser-1",
      name: "Browser Runtime",
      type: "browser",
      state: { enabled: false },
    };

    const updatedServices: Array<ServiceDescriptor> = [
      {
        uuid: "svc-1",
        serviceId: "hookup.to/service/timer",
        serviceName: "Timer",
        state: { periodic: true, periodicValue: 5 },
      },
      {
        uuid: "svc-2",
        serviceId: "hookup.to/service/input",
        serviceName: "Input",
        state: { mode: "eventsource", url: "https://example.test/events" },
      },
    ];

    const scope = {
      setState: vi.fn(),
    } as any;

    const browserApi = {
      addRuntime: vi.fn(),
      removeRuntime: vi.fn(async () => {}),
      restoreRuntime: vi.fn(async () => null),
      processRuntime: vi.fn(),
      addService: vi.fn(),
      removeService: vi.fn(),
      configureService: vi.fn(async () => ({})),
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
        initialState={{
          runtimes: [runtime],
          services: {
            [runtime.id]: updatedServices,
          },
          scopes: {
            [runtime.id]: scope,
          },
          registry: {
            [runtime.id]: [],
          },
        }}
      >
        <ContextProbe onChange={(ctx) => (latestCtx = ctx)} />
      </BoardProvider>,
    );

    await waitFor(() => {
      expect(latestCtx).toBeTruthy();
    });

    const originalScopeRef = latestCtx!.scopes[runtime.id];

    const updatedRuntimeConfig: RuntimeConfiguration = {
      runtime: {
        ...runtime,
        name: "Browser Runtime Updated",
        state: { enabled: true, marker: "updated" },
      },
      services: updatedServices,
    };

    await act(async () => {
      await latestCtx!.updateRuntime(runtime.id, updatedRuntimeConfig);
    });

    expect(browserApi.restoreRuntime).not.toHaveBeenCalled();
    expect(browserApi.configureService).toHaveBeenCalledTimes(
      updatedServices.length,
    );

    expect(browserApi.configureService).toHaveBeenNthCalledWith(
      1,
      scope,
      updatedServices[0],
      updatedServices[0],
    );
    expect(browserApi.configureService).toHaveBeenNthCalledWith(
      2,
      scope,
      updatedServices[1],
      updatedServices[1],
    );

    expect(scope.setState).toHaveBeenCalledWith(
      updatedRuntimeConfig.runtime.state,
    );

    await waitFor(() => {
      expect(latestCtx!.runtimes[0].name).toBe("Browser Runtime Updated");
    });

    expect(latestCtx!.scopes[runtime.id]).toBe(originalScopeRef);
  });
});
