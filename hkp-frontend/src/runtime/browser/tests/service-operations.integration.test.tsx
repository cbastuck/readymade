import React, { useContext, useEffect } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, waitFor } from "@testing-library/react";

import BoardProvider, {
  BoardCtx,
  BoardContextState,
} from "hkp-frontend/src/BoardContext";
import { RuntimeApiMap, RuntimeDescriptor, ServiceDescriptor } from "hkp-frontend/src/types";
import { parsePreset, savePreset } from "hkp-frontend/src/core/presets";

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
  describe("addService from a palette preset", () => {
    // A sub-service preset is offered in the sidebar as a card of its own, so
    // dropping one has to produce the building block it names — configured,
    // and called what the card was called — rather than an empty sub-service.
    const COMPOSED = {
      preset: "v1",
      id: "telegram-responder",
      name: "Telegram responder",
      serviceId: "sub-service",
      serviceName: "Telegram responder",
      state: { pipeline: [{ serviceId: "timer", instanceId: "t", state: {} }] },
    };

    beforeEach(() => window.localStorage.clear());
    afterEach(() => window.localStorage.clear());

    it("creates the service under the preset's name and configures it from the preset", async () => {
      savePreset(parsePreset(COMPOSED));
      const api = makeApi({
        addService: vi.fn(async (_scope: any, service: any) => ({
          uuid: "svc-new",
          serviceId: service.serviceId,
          serviceName: service.serviceName,
          // What a runtime answers a create with: the state of a service that
          // has just been made, which is not yet the preset's.
          state: { pipeline: [] },
        })),
        getServiceConfig: vi.fn(async () => COMPOSED.state),
      });
      const { getCtx } = renderBoard(api);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        await getCtx()!.addService(
          {
            serviceId: "sub-service",
            serviceName: "Telegram responder",
            preset: { id: "telegram-responder", serviceId: "sub-service" },
          } as any,
          runtime,
        );
      });

      // Named at creation rather than renamed afterwards.
      expect(api.addService.mock.calls[0][1].serviceName).toBe(
        "Telegram responder",
      );
      // Configured with the preset, and before the board was told it exists —
      // a panel reads a service's configuration once, when it first sees it.
      const configured = api.configureService.mock.calls[0];
      expect(configured[2]).toEqual(COMPOSED.state);
      await waitFor(() => {
        expect(getCtx()!.services[runtime.id]).toHaveLength(1);
      });
      expect(getCtx()!.services[runtime.id][0].serviceName).toBe(
        "Telegram responder",
      );
      // The empty initial configure a plain add does is not also sent.
      expect(api.configureService).toHaveBeenCalledTimes(1);
    });

    it("publishes the configured state, not the one the create answered with", async () => {
      // A nested pipeline is rendered straight off the board's descriptor
      // (SubServicePipelineUI reads `service.state.pipeline`), so publishing
      // the create's answer shows an empty sub-service while its runtime holds
      // the whole pipeline.
      savePreset(parsePreset(COMPOSED));
      const api = makeApi({
        addService: vi.fn(async (_scope: any, service: any) => ({
          uuid: "svc-new",
          serviceId: service.serviceId,
          serviceName: service.serviceName,
          state: { pipeline: [] },
        })),
        getServiceConfig: vi.fn(async () => COMPOSED.state),
      });
      const { getCtx } = renderBoard(api);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        await getCtx()!.addService(
          {
            serviceId: "sub-service",
            serviceName: "Telegram responder",
            preset: { id: "telegram-responder", serviceId: "sub-service" },
          } as any,
          runtime,
        );
      });

      await waitFor(() => {
        expect(getCtx()!.services[runtime.id]).toHaveLength(1);
      });
      expect(getCtx()!.services[runtime.id][0].state).toEqual(COMPOSED.state);
    });
  });

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
