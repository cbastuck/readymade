import { describe, expect, it, vi } from "vitest";

import { findService, isBuiltInside, processService } from "../boardServices";
import { processService as processOverRest } from "hkp-frontend/src/runtime/rest/RuntimeRestApi";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";

/**
 * A facade reaching a service inside a scope.
 *
 * What a board lists is the service at the top; everything an address names
 * after that is inside it and the board holds no descriptor for it. So the
 * root is what says which runtime to dial, and the whole address is what gets
 * dialled — the runtime walks the rest. Without this a scope could be driven
 * but nothing inside it read, which is what kept boards from nesting the
 * services their panels are written against.
 */

function contextWithScope(): BoardContextState {
  return {
    scopes: {
      node: {
        app: {},
        authenticatedUser: undefined,
        descriptor: { id: "node", type: "rest", url: "http://127.0.0.1:8080" },
      },
    },
    services: {
      node: [{ uuid: "read", serviceId: "sub-service", state: { pipeline: [] } }],
    },
    runtimes: [{ id: "node", type: "rest", url: "http://127.0.0.1:8080" }],
    runtimeApis: {
      // The runtime's own way of asking, which for a REST runtime dials it.
      rest: { configureService: vi.fn(), processService: processOverRest },
    },
  } as unknown as BoardContextState;
}

describe("a facade addressing a service inside a scope", () => {
  it("resolves a nested address through the scope holding it", () => {
    const service = findService(contextWithScope(), "read.kept-articles");

    expect(service).not.toBeNull();
    expect(service?.uuid).toBe("read.kept-articles");
  });

  it("holds no state for one, because the board lists none", () => {
    // The scope's own state is not the nested service's, and handing it over
    // would draw one service's values under another's name. What it reports
    // arrives when it first speaks.
    const nested = findService(contextWithScope(), "read.kept-articles");
    const scope = findService(contextWithScope(), "read");

    expect(nested?.state).toBeUndefined();
    expect(scope?.state).toEqual({ pipeline: [] });
  });

  it("reads one's own state where the scope's state lists it", () => {
    // A remote sub-service reports the services inside it, each with its own
    // state. A mount's address is held there and never reported, so without
    // this a widget reading it waits forever.
    const context = contextWithScope();
    context.services.node[0].state = {
      pipeline: [
        { uuid: "kept-articles", state: { count: 3 } },
        { uuid: "feed-serve", state: { __hkpMount: "http://127.0.0.1:8080/hosted/abc" } },
      ],
    };

    expect(findService(context, "read.feed-serve")?.state).toEqual({
      __hkpMount: "http://127.0.0.1:8080/hosted/abc",
    });
    expect(findService(context, "read.absent")?.state).toBeUndefined();
  });

  it("finds it by the instanceId a runtime reports it under", () => {
    // What hkp-node and hkp-python actually send for a scope's pipeline, and
    // what a board writes for one: the nested entry is an instanceId.
    const context = contextWithScope();
    context.services.node[0].state = {
      pipeline: [
        { serviceId: "sql", instanceId: "kept-articles", state: { count: 3 } },
        {
          serviceId: "http-server-subservices",
          instanceId: "feed-serve",
          state: { __hkpMount: "http://127.0.0.1:8080/hosted/abc" },
        },
      ],
    };

    expect(findService(context, "read.feed-serve")?.state).toEqual({
      __hkpMount: "http://127.0.0.1:8080/hosted/abc",
    });
  });

  it("does not resolve an address whose root is not on the board", () => {
    expect(findService(contextWithScope(), "absent.kept-articles")).toBeNull();
  });

  it("processes a nested service at its full address", () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, text: async () => "" } as Response),
    );
    vi.stubGlobal("fetch", fetchMock);

    processService(contextWithScope(), "read.record-article", { intent: "keep" });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://127.0.0.1:8080/runtimes/node/services/read.record-article/process",
    );
    vi.unstubAllGlobals();
  });
});

describe("whether init may run against a scope", () => {
  // Init processes a service and a widget listens to one inside it. Running
  // init before the scope has built what it holds hands its first answer to
  // nobody, so a holder named by its own uuid is waited for as well.
  function browserContext(holder: Record<string, unknown>): BoardContextState {
    return {
      scopes: {
        ui: {
          findServiceInstance: (uuid: string) => (uuid === "menu" ? [holder] : []),
        },
      },
      services: { ui: [{ uuid: "menu", serviceId: "sub-service", state: {} }] },
      runtimes: [{ id: "ui", type: "browser" }],
    } as unknown as BoardContextState;
  }

  it("waits for a holder named by its own uuid to build its pipeline", () => {
    const holder = { isScopeBuilt: () => false, processNested: vi.fn(), findNested: () => null };
    expect(isBuiltInside(browserContext(holder), "menu")).toBe(false);
  });

  it("runs once the holder has built it", () => {
    const view = { isScopeBuilt: () => true };
    const holder = {
      isScopeBuilt: () => true,
      processNested: vi.fn(),
      findNested: (rest: string) => (rest === "view" ? view : null),
    };
    expect(isBuiltInside(browserContext(holder), "menu")).toBe(true);
    expect(isBuiltInside(browserContext(holder), "menu.view")).toBe(true);
    expect(isBuiltInside(browserContext(holder), "menu.absent")).toBe(false);
  });

  it("waits for a holder inside a holder, named by its address", () => {
    const tracks = { isScopeBuilt: () => false };
    const holder = {
      isScopeBuilt: () => true,
      processNested: vi.fn(),
      findNested: (rest: string) => (rest === "both" ? tracks : null),
    };
    expect(isBuiltInside(browserContext(holder), "menu.both")).toBe(false);
  });

  it("counts a service that holds nothing as built", () => {
    expect(isBuiltInside(browserContext({}), "menu")).toBe(true);
  });
});
