import { afterEach, describe, expect, it, vi } from "vitest";

import restApi from "../RuntimeRestApi";
import { AssetDescriptor } from "hkp-frontend/src/runtime/board/assets";
import {
  RuntimeApiMap,
  RuntimeDescriptor,
  ServiceDescriptor,
} from "hkp-frontend/src/types";
import { pushAssetChanges, rewriteAssetRefs } from "hkp-frontend/src/core/assetActions";

/**
 * Descriptors reach a remote runtime whenever it comes to need them.
 *
 * The moments secrets have — provisioning, a configuration naming one, and
 * re-attaching to a runtime that restarted — plus one they do not: an asset
 * edited while the board runs, which is what makes the edit take effect.
 */

const runtime: RuntimeDescriptor = {
  id: "relay",
  name: "Relay",
  type: "rest",
  url: "http://127.0.0.1:8080",
} as RuntimeDescriptor;

const page: AssetDescriptor = { id: "page", mediaType: "text/html", text: "<p>v1</p>" };
const script: AssetDescriptor = { id: "script", mediaType: "text/javascript", text: "1" };
const unused: AssetDescriptor = { id: "unused", mediaType: "text/plain", text: "x" };

const serving = [
  {
    uuid: "radio",
    serviceId: "http-server-subservices",
    serviceName: "Radio",
    state: {
      onRequest: [
        {
          serviceId: "map",
          state: {
            template: {
              "body=": "params.meta.path == '/app.js' ? 'hkp-asset://script' : 'hkp-asset://page'",
            },
          },
        },
      ],
    },
  },
] as Array<ServiceDescriptor>;

function mockFetch(handler: (url: string, init?: any) => any) {
  const fetchMock = vi.fn(async (url: string, init?: any) => handler(url, init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentTo(fetchMock: ReturnType<typeof mockFetch>, match: string) {
  const call = fetchMock.mock.calls.find(
    ([url, init]) => String(url).endsWith(match) && (init as any)?.body,
  );
  return call?.[1]?.body ? JSON.parse(call[1].body as string) : undefined;
}

const created = () => ({
  ok: true,
  status: 200,
  json: async () => ({
    runtimes: [{ id: "relay", name: "Relay", services: [], outputUrl: "" }],
    registry: [],
  }),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assets reaching a remote runtime", () => {
  it("rides with the create payload — only what its services reference", async () => {
    const fetchMock = mockFetch(created);

    await restApi.restoreRuntime(runtime, serving, null, "Radio", () => [page, script, unused]);

    expect(sentTo(fetchMock, "/runtimes").assets).toEqual({ page, script });
  });

  it("is pushed again when re-attaching, since a restarted runtime lost its store", async () => {
    const fetchMock = mockFetch((url, init) => {
      if (url.endsWith("/runtimes") && !init?.method) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            runtimes: [{ id: "relay", name: "Relay", services: serving, outputUrl: "" }],
            registry: [],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    await restApi.restoreRuntime(runtime, serving, null, "Radio", () => [page, script]);

    expect(sentTo(fetchMock, "/runtimes/relay/assets")).toEqual({ page, script });
  });

  it("is pushed before a configuration that names one", async () => {
    const fetchMock = mockFetch(() => ({ ok: true, status: 200, json: async () => ({}) }));
    const scope = {
      descriptor: runtime,
      services: [],
      authenticatedUser: null,
      assets: () => [page, script],
    } as never;

    await restApi.configureService(scope, { uuid: "a" } as never, {
      asset: "hkp-asset://page",
    });

    const calls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calls).toEqual([
      "http://127.0.0.1:8080/runtimes/relay/assets",
      "http://127.0.0.1:8080/runtimes/relay/services/a",
    ]);
    expect(sentTo(fetchMock, "/assets")).toEqual({ page });
  });

  it("says nothing when a configuration names no asset", async () => {
    const fetchMock = mockFetch(() => ({ ok: true, status: 200, json: async () => ({}) }));
    const scope = { descriptor: runtime, services: [], authenticatedUser: null, assets: () => [page] } as never;

    await restApi.configureService(scope, { uuid: "a" } as never, { bypass: false });

    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/assets"))).toHaveLength(0);
  });
});

describe("an edit on the running board", () => {
  const boardWith = (states: Record<string, unknown>) => {
    const push = vi.fn(async () => {});
    const configure = vi.fn(async () => ({}));
    const api = {
      getServiceConfig: async (_scope: unknown, svc: { uuid: string }) => states[svc.uuid],
      pushAssets: push,
      configureService: configure,
    };
    const runtimes = [
      runtime,
      { id: "other", name: "Other", type: "rest", url: "http://127.0.0.1:8081" },
      { id: "unit.rt", name: "Unit", type: "rest", url: "http://127.0.0.1:8082", unit: "unit" },
    ] as RuntimeDescriptor[];
    const board = {
      runtimes,
      scopes: { relay: {} as never, other: {} as never, "unit.rt": {} as never },
      services: {
        relay: [{ uuid: "radio", serviceId: "x", serviceName: "Radio" }],
        other: [{ uuid: "timer", serviceId: "y", serviceName: "Timer" }],
        "unit.rt": [{ uuid: "unit-svc", serviceId: "z", serviceName: "U" }],
      } as never,
      runtimeApis: { rest: api } as unknown as RuntimeApiMap,
    };
    return { board, push, configure };
  };

  it("pushes a changed descriptor to the runtimes that reference it, and no others", async () => {
    const { board, push } = boardWith({
      radio: { body: "hkp-asset://page" },
      timer: { interval: 1000 },
      "unit-svc": { body: "hkp-asset://page" },
    });
    const edited = { ...page, text: "<p>v2</p>" };

    await pushAssetChanges(board, { page: edited });

    // Once, to the relay: the other runtime does not reference it, and the
    // unit's runtime resolves against the unit's own assets.
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]).toEqual([board.scopes.relay, { page: edited }]);
  });

  it("finds a reference by what the service holds now, not what the board loaded", async () => {
    const { board, push } = boardWith({ radio: {}, timer: { note: "hkp-asset://page" } });

    await pushAssetChanges(board, { page });

    expect(push.mock.calls.map(([scope]) => scope)).toEqual([board.scopes.other]);
  });

  it("removes a deleted asset from every runtime of the board's own", async () => {
    const { board, push } = boardWith({ radio: {}, timer: {}, "unit-svc": {} });

    await pushAssetChanges(board, { page: null });

    expect(push).toHaveBeenCalledTimes(2);
    for (const [, sent] of push.mock.calls as unknown as Array<[unknown, unknown]>) {
      expect(sent).toEqual({ page: null });
    }
  });

  it("reconfigures only the services a rename touches", async () => {
    const { board, configure } = boardWith({
      radio: { body: "hkp-asset://page" },
      timer: { interval: 1000 },
    });

    expect(await rewriteAssetRefs(board, "page", "player")).toBe(1);
    expect(configure).toHaveBeenCalledWith(board.scopes.relay, { uuid: "radio" }, {
      body: "hkp-asset://player",
    });
  });
});
