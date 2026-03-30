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

function makeApi(overrides: Partial<typeof defaultApi> = {}) {
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
    rearrangeServices: vi.fn(async (_, svcs) => svcs),
  };
  return { ...defaultApi, ...overrides } as any;
}

function renderBoard(api: any, initialServices: ServiceDescriptor[] = []) {
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
    >
      <ContextProbe onChange={(ctx) => (latestCtx = ctx)} />
    </BoardProvider>,
  );

  return { getCtx: () => latestCtx };
}

describe("service operations integration", () => {
  describe("addService", () => {
    it("appends a new service to the runtime", async () => {
      const api = makeApi();
      const { getCtx } = renderBoard(api);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        await getCtx()!.addService(
          { serviceId: "hookup.to/service/input", serviceName: "Input" } as any,
          runtime,
        );
      });

      await waitFor(() => {
        expect(getCtx()!.services[runtime.id]).toHaveLength(1);
      });

      expect(getCtx()!.services[runtime.id][0].uuid).toBe("svc-new");
      expect(api.addService).toHaveBeenCalledTimes(1);
    });

    it("appends without replacing existing services", async () => {
      const existingService: ServiceDescriptor = {
        uuid: "svc-existing",
        serviceId: "hookup.to/service/output",
        serviceName: "Output",
      };
      const api = makeApi({
        addService: vi.fn(async () => ({
          uuid: "svc-second",
          serviceId: "hookup.to/service/input",
          serviceName: "Input",
        })),
      });
      const { getCtx } = renderBoard(api, [existingService]);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        await getCtx()!.addService(
          { serviceId: "hookup.to/service/input", serviceName: "Input" } as any,
          runtime,
        );
      });

      await waitFor(() => {
        expect(getCtx()!.services[runtime.id]).toHaveLength(2);
      });

      expect(getCtx()!.services[runtime.id].map((s) => s.uuid)).toEqual([
        "svc-existing",
        "svc-second",
      ]);
    });

    it("calls configureService when a prototype is provided", async () => {
      const api = makeApi();
      const { getCtx } = renderBoard(api);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      const prototype = {
        uuid: "svc-new",
        state: { url: "https://example.com" },
      } as any;

      await act(async () => {
        await getCtx()!.addService(
          { serviceId: "hookup.to/service/input", serviceName: "Input" } as any,
          runtime,
          prototype,
        );
      });

      expect(api.configureService).toHaveBeenCalledWith(
        scope,
        prototype,
        prototype.state,
      );
    });
  });

  describe("removeService", () => {
    it("removes a service from the runtime", async () => {
      const svc: ServiceDescriptor = {
        uuid: "svc-remove",
        serviceId: "hookup.to/service/input",
        serviceName: "Input",
      };
      const api = makeApi();
      const { getCtx } = renderBoard(api, [svc]);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        await getCtx()!.removeService(svc, runtime);
      });

      await waitFor(() => {
        expect(getCtx()!.services[runtime.id]).toHaveLength(0);
      });

      expect(api.removeService).toHaveBeenCalledWith(scope, svc);
    });

    it("only removes the targeted service and keeps others", async () => {
      const svcA: ServiceDescriptor = {
        uuid: "svc-a",
        serviceId: "hookup.to/service/input",
        serviceName: "Input",
      };
      const svcB: ServiceDescriptor = {
        uuid: "svc-b",
        serviceId: "hookup.to/service/output",
        serviceName: "Output",
      };
      const api = makeApi();
      const { getCtx } = renderBoard(api, [svcA, svcB]);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        await getCtx()!.removeService(svcA, runtime);
      });

      await waitFor(() => {
        expect(getCtx()!.services[runtime.id]).toHaveLength(1);
      });

      expect(getCtx()!.services[runtime.id][0].uuid).toBe("svc-b");
    });

    it("calls onRemoveService prop when provided", async () => {
      const svc: ServiceDescriptor = {
        uuid: "svc-cb",
        serviceId: "hookup.to/service/input",
        serviceName: "Input",
      };
      const onRemoveService = vi.fn();
      const api = makeApi();
      const runtimeApis: RuntimeApiMap = { browser: api };
      let latestCtx: BoardContextState | null = null;

      render(
        <BoardProvider
          user={null}
          boardName="test-board"
          runtimeApis={runtimeApis}
          onRemoveRuntime={vi.fn(async () => {})}
          onRemoveService={onRemoveService}
          initialState={{
            runtimes: [runtime],
            services: { [runtime.id]: [svc] },
            scopes: { [runtime.id]: scope },
            registry: { [runtime.id]: [] },
          }}
        >
          <ContextProbe onChange={(ctx) => (latestCtx = ctx)} />
        </BoardProvider>,
      );

      await waitFor(() => expect(latestCtx).toBeTruthy());

      await act(async () => {
        await latestCtx!.removeService(svc, runtime);
      });

      expect(onRemoveService).toHaveBeenCalledWith(svc, runtime);
    });
  });

  describe("removeAllServices", () => {
    it("removes all services from a runtime", async () => {
      const services: ServiceDescriptor[] = [
        { uuid: "svc-1", serviceId: "hookup.to/service/input", serviceName: "Input" },
        { uuid: "svc-2", serviceId: "hookup.to/service/output", serviceName: "Output" },
        { uuid: "svc-3", serviceId: "hookup.to/service/filter", serviceName: "Filter" },
      ];
      const api = makeApi();
      const { getCtx } = renderBoard(api, services);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        await getCtx()!.removeAllServices(runtime);
      });

      await waitFor(() => {
        expect(getCtx()!.services[runtime.id]).toHaveLength(0);
      });

      expect(api.removeService).toHaveBeenCalledTimes(3);
    });
  });

  describe("arrangeService", () => {
    it("calls rearrangeServices and updates service order", async () => {
      const svcA: ServiceDescriptor = {
        uuid: "svc-a",
        serviceId: "hookup.to/service/input",
        serviceName: "Input",
      };
      const svcB: ServiceDescriptor = {
        uuid: "svc-b",
        serviceId: "hookup.to/service/output",
        serviceName: "Output",
      };
      const api = makeApi({
        rearrangeServices: vi.fn(async () => [svcB, svcA]),
      });
      const { getCtx } = renderBoard(api, [svcA, svcB]);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        await getCtx()!.arrangeService(runtime, svcA.uuid, 1);
      });

      await waitFor(() => {
        expect(getCtx()!.services[runtime.id].map((s) => s.uuid)).toEqual([
          "svc-b",
          "svc-a",
        ]);
      });

      expect(api.rearrangeServices).toHaveBeenCalledTimes(1);
    });
  });

  describe("setServiceName", () => {
    it("updates the serviceName of the target service", async () => {
      const svc: ServiceDescriptor = {
        uuid: "svc-rename",
        serviceId: "hookup.to/service/input",
        serviceName: "Input",
      };
      const api = makeApi();
      const { getCtx } = renderBoard(api, [svc]);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        await getCtx()!.setServiceName(runtime.id, svc.uuid, "My Input");
      });

      await waitFor(() => {
        expect(getCtx()!.services[runtime.id][0].serviceName).toBe("My Input");
      });
    });

    it("only renames the targeted service", async () => {
      const svcA: ServiceDescriptor = {
        uuid: "svc-a",
        serviceId: "hookup.to/service/input",
        serviceName: "Input",
      };
      const svcB: ServiceDescriptor = {
        uuid: "svc-b",
        serviceId: "hookup.to/service/output",
        serviceName: "Output",
      };
      const api = makeApi();
      const { getCtx } = renderBoard(api, [svcA, svcB]);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        await getCtx()!.setServiceName(runtime.id, svcA.uuid, "Renamed Input");
      });

      await waitFor(() => {
        expect(getCtx()!.services[runtime.id][0].serviceName).toBe("Renamed Input");
      });

      expect(getCtx()!.services[runtime.id][1].serviceName).toBe("Output");
    });
  });
});
