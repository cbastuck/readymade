import { afterEach, describe, expect, it, vi } from "vitest";

import { addService, attachRuntimes } from "../RealtimeRuntimeApi";
import { makeServiceInstance } from "../RuntimeRest";
import { RuntimeScope, ServiceDescriptor } from "hkp-frontend/src/types";

describe("realtime capabilities contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("makeServiceInstance enriches missing capabilities from registry", async () => {
    const api = {
      processService: vi.fn(async () => ({ ok: true })),
      configureService: vi.fn(async () => ({})),
      getServiceConfig: vi.fn(async () => ({})),
    };

    const app = {
      listAvailableServices: vi.fn(() => [
        {
          serviceId: "sub-service",
          serviceName: "SubService",
          capabilities: ["subservices"],
        },
      ]),
    };

    const scope = {
      getApi: () => api,
      getApp: () => app,
    } as unknown as RuntimeScope;

    const descriptor = {
      uuid: "svc-1",
      serviceId: "sub-service",
      serviceName: "SubService",
      state: { bypass: false },
    } as ServiceDescriptor;

    const instance = makeServiceInstance(scope, descriptor, "board-1");

    expect(instance.capabilities).toEqual(["subservices"]);

    await instance.configure({ pipeline: [] });
    expect(api.configureService).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({
        serviceId: "sub-service",
        capabilities: ["subservices"],
      }),
      { pipeline: [] },
    );
  });

  it("makeServiceInstance preserves explicit descriptor capabilities", () => {
    const api = {
      processService: vi.fn(async () => ({ ok: true })),
      configureService: vi.fn(async () => ({})),
      getServiceConfig: vi.fn(async () => ({})),
    };

    const app = {
      listAvailableServices: vi.fn(() => [
        {
          serviceId: "sub-service",
          serviceName: "SubService",
          capabilities: ["subservices"],
        },
      ]),
    };

    const scope = {
      getApi: () => api,
      getApp: () => app,
    } as unknown as RuntimeScope;

    const descriptor = {
      uuid: "svc-2",
      serviceId: "sub-service",
      serviceName: "SubService",
      capabilities: ["custom"],
      state: {},
    } as ServiceDescriptor;

    const instance = makeServiceInstance(scope, descriptor, "board-1");
    expect(instance.capabilities).toEqual(["custom"]);
  });

  it("addService enriches created descriptor from scope registry", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ bypass: false }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const scope = {
      descriptor: { id: "runtime-1", url: "http://runtime.test" },
      registry: [
        {
          serviceId: "sub-service",
          serviceName: "SubService",
          capabilities: ["subservices"],
        },
      ],
    } as any;

    const created = await addService(scope, {
      serviceId: "sub-service",
      serviceName: "SubService",
    });

    expect(created?.capabilities).toEqual(["subservices"]);

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody.capabilities).toEqual(["subservices"]);
  });

  it("attachRuntimes normalizes sub-service capability from registry", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        runtimes: [
          {
            id: "runtime-2",
            name: "node-runtime",
            services: [],
            outputUrl: "",
          },
        ],
        registry: [
          {
            serviceId: "sub-service",
            serviceName: "SubService",
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const state = await attachRuntimes(
      {
        type: "realtime",
        name: "Node Runtime",
        url: "http://runtime.test",
      },
      null,
    );

    expect(state.registry["runtime-2"][0].capabilities).toContain(
      "subservices",
    );
  });
});
