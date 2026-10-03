import { afterEach, describe, expect, it, vi } from "vitest";

import restApi, { pushAssetsTo } from "../RuntimeRestApi";
import { AssetDescriptor } from "hkp-frontend/src/runtime/board/assets";
import {
  RuntimeApiMap,
  RuntimeDescriptor,
  ServiceDescriptor,
} from "hkp-frontend/src/types";
import {
  assetUses,
  checkAssetOnRuntimes,
  pushAssetChanges,
  renameAssetOnRuntimes,
  rewriteAssetRefs,
} from "hkp-frontend/src/core/assetActions";

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

  it("answers why a runtime did not take a push, rather than throwing", async () => {
    mockFetch(() => ({ ok: true, status: 200 }));
    expect(await pushAssetsTo(runtime, { page }, null)).toBeNull();

    mockFetch(() => ({ ok: false, status: 503 }));
    expect(await pushAssetsTo(runtime, { page }, null)).toBe("Relay answered 503");

    mockFetch(() => {
      throw new Error("Failed to fetch");
    });
    expect(await pushAssetsTo(runtime, { page }, null)).toBe(
      "Relay is unreachable: Failed to fetch",
    );
  });
});

describe("an edit on the running board", () => {
  const boardWith = (states: Record<string, unknown>) => {
    const push = vi.fn(async (): Promise<string | null> => null);
    const configure = vi.fn(async (): Promise<object> => ({}));
    const check = vi.fn(async () => ({ ok: true, mediaType: "text/html", size: 9 }));
    const api = {
      getServiceConfig: async (_scope: unknown, svc: { uuid: string }) => states[svc.uuid],
      pushAssets: push,
      configureService: configure,
      checkAsset: check,
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
    return { board, push, configure, check };
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

  it("names the runtimes that did not take a descriptor", async () => {
    const { board, push } = boardWith({
      radio: { body: "hkp-asset://page" },
      timer: { note: "hkp-asset://page" },
    });
    push.mockImplementation(async (scope: unknown) =>
      scope === board.scopes.relay ? "Relay answered 503" : null,
    );

    expect(await pushAssetChanges(board, { page })).toEqual([
      { runtime, problem: "Relay answered 503", push: { page } },
    ]);
  });

  it("names the runtimes a deletion did not reach: they still hold the asset", async () => {
    const { board, push } = boardWith({ radio: {}, timer: {} });
    push.mockImplementation(async (scope: unknown) =>
      scope === board.scopes.other ? "Other is unreachable" : null,
    );

    expect(await pushAssetChanges(board, { page: null })).toEqual([
      { runtime: board.runtimes[1], problem: "Other is unreachable", push: { page: null } },
    ]);
  });

  it("gives a renamed asset to the runtimes naming the old id before rewriting them", async () => {
    const { board, push, configure } = boardWith({
      radio: { body: "hkp-asset://page" },
      timer: { interval: 1000 },
    });
    const order: string[] = [];
    push.mockImplementation(async () => (order.push("push"), null));
    configure.mockImplementation(async () => (order.push("configure"), {}));
    const player = { ...page, id: "player" };

    expect(await renameAssetOnRuntimes(board, player, "page")).toBe(1);

    // To the relay alone, which names `page`; nothing names `player` yet.
    expect(push.mock.calls).toEqual([[board.scopes.relay, { player }]]);
    expect(order).toEqual(["push", "configure"]);
  });

  it("rewrites nothing when a runtime does not take the renamed asset", async () => {
    const { board, push, configure } = boardWith({
      radio: { body: "hkp-asset://page" },
      timer: { note: "hkp-asset://page" },
    });
    push.mockImplementation(async (scope: unknown) =>
      scope === board.scopes.other ? "Other answered 503" : null,
    );

    const player = { ...page, id: "player" };

    await expect(renameAssetOnRuntimes(board, player, "page")).rejects.toThrow(
      "Other answered 503",
    );
    expect(configure).not.toHaveBeenCalled();
    // The relay took it, and is not left holding an asset the board never declared.
    expect(push.mock.calls).toEqual([
      [board.scopes.relay, { player }],
      [board.scopes.other, { player }],
      [board.scopes.relay, { player: null }],
    ]);
  });

  it("takes the renamed asset back when a service does not take the rename", async () => {
    const { board, push, configure } = boardWith({
      radio: { body: "hkp-asset://page" },
      timer: { note: "hkp-asset://page" },
    });
    configure.mockImplementation(async (scope: unknown, _svc: unknown, state: any) => {
      if (scope === board.scopes.other && state.note === "hkp-asset://player") {
        throw new Error("Service Unavailable");
      }
      return {};
    });

    await expect(
      renameAssetOnRuntimes(board, { ...page, id: "player" }, "page"),
    ).rejects.toThrow("Timer on Other was not reconfigured: Service Unavailable");
    expect(push.mock.calls.slice(2)).toEqual([
      [board.scopes.relay, { player: null }],
      [board.scopes.other, { player: null }],
    ]);
  });

  it("leaves the renamed asset where a service still names it, and says where it could not be taken back", async () => {
    const { board, push, configure } = boardWith({
      radio: { body: "hkp-asset://page" },
      timer: { note: "hkp-asset://page" },
      extra: { cover: "hkp-asset://page" },
    });
    board.runtimes.push({ id: "third", name: "Third", type: "rest" } as RuntimeDescriptor);
    (board.scopes as Record<string, unknown>).third = {};
    (board.services as Record<string, unknown>).third = [
      { uuid: "extra", serviceId: "w", serviceName: "Extra" },
    ];
    configure.mockImplementation(async (scope: unknown, _svc: unknown, state: any) => {
      // The extra does not take the rename, and the radio does not take being put back.
      if (scope === board.scopes.third || state.body === "hkp-asset://page") {
        throw new Error("Service Unavailable");
      }
      return {};
    });
    push.mockImplementation(async (scope: unknown, sent: any) =>
      scope === board.scopes.other && sent.player === null ? "Other answered 503" : null,
    );

    await expect(
      renameAssetOnRuntimes(board, { ...page, id: "player" }, "page"),
    ).rejects.toThrow(
      'Radio on Relay could not be put back and still names "player"; "player" could not be taken back from Other',
    );
    // Not from the relay, whose radio still names it.
    expect(push.mock.calls.slice(3)).toEqual([
      [board.scopes.other, { player: null }],
      [(board.scopes as Record<string, unknown>).third, { player: null }],
    ]);
  });

  it("names a service it could not put back", async () => {
    const { board, configure } = boardWith({
      radio: { body: "hkp-asset://page" },
      timer: { note: "hkp-asset://page" },
    });
    configure.mockImplementation(async (scope: unknown, _svc: unknown, state: any) => {
      // The timer does not take the rename, and the radio does not take being put back.
      if (scope === board.scopes.other || state.body === "hkp-asset://page") {
        throw new Error("Service Unavailable");
      }
      return {};
    });

    await expect(rewriteAssetRefs(board, "page", "player")).rejects.toThrow(
      'Timer on Other was not reconfigured: Service Unavailable; Radio on Relay could not be put back and still names "player"',
    );
  });

  it("leaves a unit's services out of where an asset is used and checked", async () => {
    const { board, check } = boardWith({
      radio: { body: "hkp-asset://page" },
      timer: {},
      // The unit's own `page`, which only happens to share the id.
      "unit-svc": { body: "hkp-asset://page" },
    });

    expect((await assetUses(board, "page")).map((use) => use.serviceUuid)).toEqual(["radio"]);

    const checks = await checkAssetOnRuntimes(board, "page");
    expect(checks.map(({ runtime: asked }) => asked.id)).toEqual(["relay"]);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("puts a rename back when a service does not take it", async () => {
    const { board, configure } = boardWith({
      radio: { body: "hkp-asset://page" },
      timer: { note: "hkp-asset://page" },
    });
    configure.mockImplementation(async (scope: unknown, _svc: unknown, state: any) => {
      if (scope === board.scopes.other && state.note === "hkp-asset://player") {
        throw new Error("Service Unavailable");
      }
      return {};
    });

    await expect(rewriteAssetRefs(board, "page", "player")).rejects.toThrow(
      "Timer on Other was not reconfigured: Service Unavailable",
    );
    // The radio was renamed, then given back what it had.
    expect(configure.mock.calls.map(([, svc, state]) => [svc, state])).toEqual([
      [{ uuid: "radio" }, { body: "hkp-asset://player" }],
      [{ uuid: "timer" }, { note: "hkp-asset://player" }],
      [{ uuid: "radio" }, { body: "hkp-asset://page" }],
    ]);
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
