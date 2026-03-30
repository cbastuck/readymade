import React, { useContext, useEffect } from "react";
import { describe, it, expect, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";

import BoardProvider, {
  BoardCtx,
  BoardContextState,
} from "hkp-frontend/src/BoardContext";
import { RuntimeApiMap, RuntimeDescriptor, ServiceDescriptor } from "hkp-frontend/src/types";

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

const runtime: RuntimeDescriptor = {
  id: "rt-browser-1",
  name: "Browser Runtime",
  type: "browser",
};

const scope = { id: "scope-1" } as any;

function makeApi(overrides: Record<string, unknown> = {}) {
  const defaultApi = {
    addRuntime: vi.fn(async () => {}),
    removeRuntime: vi.fn(async () => {}),
    restoreRuntime: vi.fn(),
    processRuntime: vi.fn(),
    addService: vi.fn(async () => ({
      uuid: "svc-new",
      serviceId: "hookup.to/service/input",
      serviceName: "Input",
    })),
    removeService: vi.fn(async () => {}),
    configureService: vi.fn(async () => {}),
    getServiceConfig: vi.fn(async () => ({})),
    processService: vi.fn(),
    rearrangeServices: vi.fn(async (_: unknown, svcs: unknown) => svcs),
  };
  return { ...defaultApi, ...overrides } as any;
}

function renderBoard(
  api: any,
  initialServices: ServiceDescriptor[] = [],
  extraProps: Record<string, unknown> = {},
) {
  const runtimeApis: RuntimeApiMap = { browser: api };
  let latestCtx: BoardContextState | null = null;

  render(
    <BoardProvider
      user={null}
      boardName="test-board"
      runtimeApis={runtimeApis}
      onRemoveRuntime={vi.fn(async () => {})}
      initialState={{
        runtimes: [runtime],
        services: { [runtime.id]: initialServices },
        scopes: { [runtime.id]: scope },
        registry: { [runtime.id]: [] },
      }}
      {...(extraProps as any)}
    >
      <ContextProbe onChange={(ctx) => (latestCtx = ctx)} />
    </BoardProvider>,
  );

  return { getCtx: () => latestCtx };
}

describe("board persistence integration", () => {
  describe("setBoardName", () => {
    it("updates boardName in the context", async () => {
      const api = makeApi();
      const { getCtx } = renderBoard(api);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        getCtx()!.setBoardName("My New Board");
      });

      await waitFor(() => {
        expect(getCtx()!.boardName).toBe("My New Board");
      });
    });

    it("overwrites a previous boardName", async () => {
      const api = makeApi();
      const { getCtx } = renderBoard(api);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        getCtx()!.setBoardName("First Name");
      });
      await waitFor(() => expect(getCtx()!.boardName).toBe("First Name"));

      await act(async () => {
        getCtx()!.setBoardName("Second Name");
      });
      await waitFor(() => {
        expect(getCtx()!.boardName).toBe("Second Name");
      });
    });
  });

  describe("serializeBoard", () => {
    it("returns a descriptor with runtime and service entries", async () => {
      const svc: ServiceDescriptor = {
        uuid: "svc-1",
        serviceId: "hookup.to/service/input",
        serviceName: "Input",
      };
      const serviceConfig = { url: "https://example.com" };
      const api = makeApi({
        getServiceConfig: vi.fn(async () => serviceConfig),
      });
      const { getCtx } = renderBoard(api, [svc]);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      let result: any;
      await act(async () => {
        result = await getCtx()!.serializeBoard();
      });

      expect(result).toBeDefined();
      expect(result.runtimes).toHaveLength(1);
      expect(result.runtimes[0].id).toBe(runtime.id);
      expect(result.services[runtime.id]).toHaveLength(1);
      expect(result.services[runtime.id][0].uuid).toBe("svc-1");
      expect(result.services[runtime.id][0].state).toEqual(serviceConfig);
      expect(api.getServiceConfig).toHaveBeenCalledWith(scope, svc);
    });

    it("delegates to serializeBoard prop when provided", async () => {
      const svc: ServiceDescriptor = {
        uuid: "svc-2",
        serviceId: "hookup.to/service/output",
        serviceName: "Output",
      };
      const transformed = { runtimes: [], services: {}, custom: true };
      const serializeBoardProp = vi.fn(() => transformed as any);
      const api = makeApi();
      const { getCtx } = renderBoard(api, [svc], {
        serializeBoard: serializeBoardProp,
      });
      await waitFor(() => expect(getCtx()).toBeTruthy());

      let result: any;
      await act(async () => {
        result = await getCtx()!.serializeBoard();
      });

      expect(serializeBoardProp).toHaveBeenCalledTimes(1);
      expect(result).toBe(transformed);
    });

    it("returns empty services map when runtime has no services", async () => {
      const api = makeApi();
      const { getCtx } = renderBoard(api, []);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      let result: any;
      await act(async () => {
        result = await getCtx()!.serializeBoard();
      });

      expect(result.runtimes).toHaveLength(1);
      expect(result.services[runtime.id]).toHaveLength(0);
    });
  });

  describe("clearBoard", () => {
    it("removes all runtimes and clears services", async () => {
      const services: ServiceDescriptor[] = [
        { uuid: "svc-1", serviceId: "hookup.to/service/input", serviceName: "Input" },
        { uuid: "svc-2", serviceId: "hookup.to/service/output", serviceName: "Output" },
      ];
      const api = makeApi();
      const { getCtx } = renderBoard(api, services);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        await getCtx()!.clearBoard();
      });

      await waitFor(() => {
        expect(getCtx()!.runtimes).toHaveLength(0);
      });
      expect(Object.keys(getCtx()!.services)).toHaveLength(0);
    });

    it("calls api.removeRuntime for each runtime", async () => {
      const api = makeApi();
      const { getCtx } = renderBoard(api);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        await getCtx()!.clearBoard();
      });

      await waitFor(() => expect(getCtx()!.runtimes).toHaveLength(0));
      expect(api.removeRuntime).toHaveBeenCalledWith(scope, runtime, null);
    });

    it("calls onClearBoard prop with prior board state", async () => {
      const onClearBoard = vi.fn(async () => {});
      const services: ServiceDescriptor[] = [
        { uuid: "svc-x", serviceId: "hookup.to/service/input", serviceName: "Input" },
      ];
      const api = makeApi();
      const { getCtx } = renderBoard(api, services, { onClearBoard });
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        await getCtx()!.clearBoard("Empty Board");
      });

      expect(onClearBoard).toHaveBeenCalledTimes(1);
      const [prevState, newName] = onClearBoard.mock.calls[0];
      expect(prevState.runtimes).toHaveLength(1);
      expect(prevState.runtimes[0].id).toBe(runtime.id);
      expect(newName).toBe("Empty Board");
    });

    it("updates boardName to the provided argument", async () => {
      const api = makeApi();
      const { getCtx } = renderBoard(api);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        await getCtx()!.clearBoard("Fresh Start");
      });

      await waitFor(() => {
        expect(getCtx()!.boardName).toBe("Fresh Start");
      });
    });
  });
});
