import { afterEach, describe, expect, it, vi } from "vitest";

import restApi, { pushAssetsTo } from "../RuntimeRestApi";
import { AssetDescriptor, assetsOfRuntime } from "hkp-frontend/src/runtime/board/assets";
import { addRuntime } from "hkp-frontend/src/core/runtimeOperations";
import {
  RuntimeApiMap,
  RuntimeDescriptor,
  ServiceDescriptor,
} from "hkp-frontend/src/types";
import {
  assetUses,
  pushAssetChanges,
  renameAssetOnRuntimes,
  rewriteAssetRefs,
} from "hkp-frontend/src/core/assetActions";

/**
 * A remote runtime is given the assets of its document — all of them, unless
 * an asset names the runtimes it is for.
 *
 * Which asset a service uses can be decided while the board runs, so a
 * reference has to resolve wherever it arrives. The moments: provisioning,
 * re-attaching to a runtime that restarted, and an asset edited while the
 * board runs, which is what makes the edit take effect.
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
  it("rides with the create payload — every one, named by a service or not", async () => {
    const fetchMock = mockFetch(created);

    await restApi.restoreRuntime(runtime, serving, null, "Radio", () => [page, script, unused]);

    expect(sentTo(fetchMock, "/runtimes").assets).toEqual({ page, script, unused });
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

    await restApi.restoreRuntime(runtime, serving, null, "Radio", () => [page, script, unused]);

    expect(sentTo(fetchMock, "/runtimes/relay/assets")).toEqual({ page, script, unused });
  });

  it("is not sent with a configuration: the runtime was given it already", async () => {
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

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "http://127.0.0.1:8080/runtimes/relay/services/a",
    ]);
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

describe("a runtime added to a board that has assets", () => {
  const added = { id: "new", name: "New", type: "rest", url: "http://127.0.0.1:8083" };
  const kept = { ...script, runtimes: ["relay"] };

  /** A board to add a runtime to, and what was done to it, in order. */
  function boardTaking(push: () => Promise<string | null>, remove = async () => {}) {
    const order: string[] = [];
    const scope = {} as { assets?: () => AssetDescriptor[] };
    const pushAssets = vi.fn(async () => {
      order.push("push");
      return push();
    });
    const removeRuntime = vi.fn(async () => {
      order.push("remove");
      return remove();
    });
    const onBoard = (what: string) => () => {
      order.push(what);
    };
    const refs = {
      propsRef: {
        current: {
          runtimeApis: {
            rest: {
              addRuntime: async () => ({ runtime: added, services: [], registry: [], scope }),
              pushAssets,
              removeRuntime,
            },
          },
        },
      },
      userRef: { current: null },
      boardNameRef: { current: "Radio" },
      // The board's assets as this runtime is given them: all but the one
      // kept to another runtime.
      assetsFor: (runtime: RuntimeDescriptor) => () =>
        assetsOfRuntime(runtime, [page, kept, unused], undefined),
      setRuntimes: onBoard("on the board"),
      setServices: onBoard("services"),
      setRegistry: onBoard("registry"),
      setScopes: onBoard("scope"),
    };
    const errors: string[] = [];
    const waitForUserLogin = vi.fn(async () => {});
    const add = () =>
      addRuntime(
        { type: "rest", name: "New", url: added.url } as never,
        refs as never,
        waitForUserLogin,
        (err) => errors.push(err.message),
      );
    return { add, order, scope, pushAssets, removeRuntime, errors, waitForUserLogin };
  }

  it("is sent them before it is on the board, since nothing later would", async () => {
    const { add, order, scope, pushAssets, errors } = boardTaking(async () => null);

    const runtime = await add();

    expect(runtime?.id).toBe("new");
    expect(pushAssets).toHaveBeenCalledWith(scope, { page, unused });
    expect(order).toEqual(["push", "on the board", "services", "registry", "scope"]);
    expect(errors).toEqual([]);
  });

  it("is not added when it does not take them, and is removed from where it was created", async () => {
    const { add, order, scope, removeRuntime, errors, waitForUserLogin } = boardTaking(
      async () => "New answered 413",
    );

    expect(await add()).toBeNull();

    // Never on the board, and not left running with nothing to resolve.
    expect(order).toEqual(["push", "remove"]);
    expect(removeRuntime).toHaveBeenCalledWith(scope, expect.objectContaining({ id: "new" }), null);
    expect(errors).toEqual([
      "it did not take the board's assets (New answered 413), so it was not added",
    ]);
    // Not a question of who is asking.
    expect(waitForUserLogin).not.toHaveBeenCalled();
  });

  it("says so when it could not be removed again either", async () => {
    const { add, order, errors } = boardTaking(
      async () => "New is unreachable: Failed to fetch",
      async () => {
        throw new Error("Failed to fetch");
      },
    );

    expect(await add()).toBeNull();

    expect(order).toEqual(["push", "remove"]);
    expect(errors).toEqual([
      "it did not take the board's assets (New is unreachable: Failed to fetch), so it was not added; it could not be removed again and is still running there",
    ]);
  });
});

describe("an edit on the running board", () => {
  const boardWith = (states: Record<string, unknown>) => {
    const push = vi.fn(async (): Promise<string | null> => null);
    const configure = vi.fn(async (): Promise<object> => ({}));
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

  it("pushes a changed descriptor to every runtime of the board's own, named there or not", async () => {
    const { board, push } = boardWith({
      radio: { body: "hkp-asset://page" },
      timer: { interval: 1000 },
      "unit-svc": { body: "hkp-asset://page" },
    });
    const edited = { ...page, text: "<p>v2</p>" };

    await pushAssetChanges(board, { page: edited });

    // The other runtime names it nowhere, and could still be handed it by a
    // request; the unit's runtime resolves against the unit's own assets.
    expect(push.mock.calls).toEqual([
      [board.scopes.relay, { page: edited }],
      [board.scopes.other, { page: edited }],
    ]);
  });

  it("keeps an asset to the runtimes it names, and takes it from the others", async () => {
    const { board, push } = boardWith({ radio: {}, timer: {} });
    const kept = { ...page, runtimes: ["relay"] };

    await pushAssetChanges(board, { page: kept });

    // A removal for the other: it may hold the asset from before it was kept
    // from it, and removing one it never had costs nothing.
    expect(push.mock.calls).toEqual([
      [board.scopes.relay, { page: kept }],
      [board.scopes.other, { page: null }],
    ]);
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

    // To every runtime it is for, before the one service naming `page` is told
    // to name `player` instead.
    expect(push.mock.calls).toEqual([
      [board.scopes.relay, { player }],
      [board.scopes.other, { player }],
    ]);
    expect(order).toEqual(["push", "push", "configure"]);
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

  it("leaves a unit's services out of where an asset is used", async () => {
    const { board } = boardWith({
      radio: { body: "hkp-asset://page" },
      timer: {},
      // The unit's own `page`, which only happens to share the id.
      "unit-svc": { body: "hkp-asset://page" },
    });

    expect((await assetUses(board, "page")).map((use) => use.serviceUuid)).toEqual(["radio"]);

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
