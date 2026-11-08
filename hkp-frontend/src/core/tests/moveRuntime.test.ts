import { describe, expect, it, vi } from "vitest";

import { moveRuntime } from "../runtimeOperations";
import type { BoardStateRefs } from "../boardContextTypes";

/**
 * Moving a runtime: rebuilt on another runtime server with the state its
 * services have now, then removed from the one it left.
 *
 * The board keeps the runtime's id and names the new server the way the
 * runtime picker would, and a move that cannot be built changes nothing.
 */

const LAPTOP = { name: "nodeJS", type: "rest", url: "http://127.0.0.1:8080" };
const CLOUD = { name: "readymadeit.com", type: "rest", url: "https://node1.readymadeit.com" };

const CLUB = {
  id: "club",
  name: "Club",
  type: "rest",
  url: LAPTOP.url,
  remote: "nodeJS",
  state: { wrapServices: false },
};

const SERVICES = [
  { uuid: "take-hour", serviceId: "sql", serviceName: "SQL", state: { query: "saved" } },
];

const OLD_SCOPE = { name: "old scope" };
const NEW_SCOPE = { name: "new scope" };

type Api = {
  getServiceConfig: ReturnType<typeof vi.fn>;
  restoreRuntime: ReturnType<typeof vi.fn>;
  removeRuntime: ReturnType<typeof vi.fn>;
  configureService: ReturnType<typeof vi.fn>;
};

function apiWith(overrides: Partial<Api> = {}): Api {
  return {
    getServiceConfig: vi.fn(async () => ({ query: "live" })),
    restoreRuntime: vi.fn(async (runtime, services) => ({
      runtime,
      services,
      scope: NEW_SCOPE,
      registry: [{ serviceId: "sql", serviceName: "SQL" }],
    })),
    removeRuntime: vi.fn(async () => {}),
    configureService: vi.fn(async () => ({})),
    ...overrides,
  };
}

function boardWith(
  api: Api,
  engines: unknown[] = [LAPTOP, CLOUD],
  runtime: Record<string, unknown> = CLUB,
) {
  const state = {
    runtimes: [runtime] as any[],
    services: { club: SERVICES } as Record<string, any>,
    registry: {} as Record<string, any>,
    scopes: { club: OLD_SCOPE } as Record<string, any>,
  };
  const apply = <T>(prev: T, next: T | ((prev: T) => T)) =>
    typeof next === "function" ? (next as (p: T) => T)(prev) : next;
  const refs = {
    runtimesRef: { current: state.runtimes },
    servicesRef: { current: state.services },
    scopesRef: { current: state.scopes },
    propsRef: { current: { runtimeApis: { rest: api } } },
    userRef: { current: null },
    boardNameRef: { current: "Court booking" },
    availableRuntimeEnginesRef: { current: engines },
    setRuntimes: vi.fn((next) => (state.runtimes = apply(state.runtimes, next))),
    setServices: vi.fn((next) => (state.services = apply(state.services, next))),
    setRegistry: vi.fn((next) => (state.registry = apply(state.registry, next))),
    setScopes: vi.fn((next) => (state.scopes = apply(state.scopes, next))),
  } as unknown as BoardStateRefs;
  return { state, refs };
}

describe("moving a runtime to another runtime server", () => {
  it("builds it there with its services' live state, then removes it where it was", async () => {
    const api = apiWith();
    const { refs, state } = boardWith(api);

    const outcome = await moveRuntime("club", CLOUD as never, refs);

    expect(outcome).toEqual({});
    const [built, carried, , boardName] = api.restoreRuntime.mock.calls[0];
    expect(built).toMatchObject({ id: "club", url: CLOUD.url, remote: "readymadeit.com" });
    expect(carried).toEqual([
      { uuid: "take-hour", serviceId: "sql", serviceName: "SQL", state: { query: "live" } },
    ]);
    expect(boardName).toBe("Court booking");
    expect(api.removeRuntime).toHaveBeenCalledWith(OLD_SCOPE, CLUB, null);
    // Built before it was removed: a failed build must leave it running.
    expect(api.restoreRuntime.mock.invocationCallOrder[0]).toBeLessThan(
      api.removeRuntime.mock.invocationCallOrder[0],
    );

    expect(state.runtimes).toEqual([
      { ...CLUB, url: CLOUD.url, remote: "readymadeit.com" },
    ]);
    expect(state.scopes.club).toBe(NEW_SCOPE);
    expect(state.registry.club).toEqual([{ serviceId: "sql", serviceName: "SQL" }]);
  });

  it("carries the board's last state for a service the old server no longer reports", async () => {
    const api = apiWith({
      getServiceConfig: vi.fn(async () => {
        throw new Error("Load failed");
      }),
    });
    const { refs } = boardWith(api);

    await moveRuntime("club", CLOUD as never, refs);

    expect(api.restoreRuntime.mock.calls[0][1][0].state).toEqual({ query: "saved" });
  });

  it("changes nothing when the new server does not build it", async () => {
    const api = apiWith({
      restoreRuntime: vi.fn(async () => {
        throw new Error("Failed to create runtime");
      }),
    });
    const { refs, state } = boardWith(api);

    await expect(moveRuntime("club", CLOUD as never, refs)).rejects.toThrow(
      "Failed to create runtime",
    );

    expect(api.removeRuntime).not.toHaveBeenCalled();
    expect(state.runtimes).toEqual([CLUB]);
    expect(state.scopes.club).toBe(OLD_SCOPE);
  });

  it("is moved even when the server it left cannot remove it, and says so", async () => {
    const api = apiWith({
      removeRuntime: vi.fn(async () => {
        throw new Error("Load failed");
      }),
    });
    const { refs, state } = boardWith(api);

    const outcome = await moveRuntime("club", CLOUD as never, refs);

    expect(outcome).toEqual({ leftBehind: "Load failed" });
    expect(state.runtimes[0].url).toBe(CLOUD.url);
  });

  it("gives the carried state to a runtime the new server was already running", async () => {
    // Attached rather than built: same id, same services, its own state.
    const api = apiWith({
      restoreRuntime: vi.fn(async (runtime) => ({
        runtime,
        services: [{ ...SERVICES[0], state: { query: "stale", __hkpMount: "x" } }],
        scope: NEW_SCOPE,
        registry: [],
      })),
    });
    const { refs } = boardWith(api);

    await moveRuntime("club", CLOUD as never, refs);

    expect(api.configureService).toHaveBeenCalledWith(
      NEW_SCOPE,
      expect.objectContaining({ uuid: "take-hour" }),
      { query: "live" },
    );
  });

  it("leaves a service alone that already holds what was carried", async () => {
    const api = apiWith({
      restoreRuntime: vi.fn(async (runtime) => ({
        runtime,
        // What the server adds of its own does not count as a difference.
        services: [{ ...SERVICES[0], state: { query: "live", __hkpMount: "x" } }],
        scope: NEW_SCOPE,
        registry: [],
      })),
    });
    const { refs } = boardWith(api);

    await moveRuntime("club", CLOUD as never, refs);

    expect(api.configureService).not.toHaveBeenCalled();
  });

  it("names the new server by address when its name would lead somewhere else", async () => {
    // The cloud server answers to `node` as an alias, but another server is
    // listed under `node`, and the listed name wins when a board is opened.
    const engines = [
      { name: "node", type: "rest", url: LAPTOP.url },
      { ...CLOUD, aliases: ["node"] },
    ];
    const api = apiWith();
    const { refs, state } = boardWith(api, engines);

    await moveRuntime("club", CLOUD as never, refs);

    expect(state.runtimes[0]).toMatchObject({ url: CLOUD.url });
    expect(state.runtimes[0]).not.toHaveProperty("remote");
  });

  it("does nothing for the server it is already on", async () => {
    const api = apiWith();
    const { refs } = boardWith(api);

    await moveRuntime("club", { ...LAPTOP, url: `${LAPTOP.url}/` } as never, refs);

    expect(api.restoreRuntime).not.toHaveBeenCalled();
    expect(api.removeRuntime).not.toHaveBeenCalled();
  });

  it("refuses a runtime a unit contributed", async () => {
    const api = apiWith();
    const { refs } = boardWith(api, [LAPTOP, CLOUD], {
      ...CLUB,
      unit: "club-unit",
      unitRuntimeId: "club",
    });

    await expect(moveRuntime("club", CLOUD as never, refs)).rejects.toThrow(
      /comes from the unit/,
    );
    expect(api.restoreRuntime).not.toHaveBeenCalled();
  });
});
