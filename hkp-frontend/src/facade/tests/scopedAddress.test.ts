import { describe, expect, it, vi } from "vitest";

import { findService, processService } from "../boardServices";
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
    scopes: { node: { app: {}, authenticatedUser: undefined } },
    services: {
      node: [{ uuid: "read", serviceId: "sub-service", state: { pipeline: [] } }],
    },
    runtimes: [{ id: "node", type: "rest", url: "http://127.0.0.1:8080" }],
    runtimeApis: { rest: { configureService: vi.fn() } },
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

  it("does not resolve an address whose root is not on the board", () => {
    expect(findService(contextWithScope(), "absent.kept-articles")).toBeNull();
  });

  it("processes a nested service at its full address", () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));
    vi.stubGlobal("fetch", fetchMock);

    processService(contextWithScope(), "read.record-article", { intent: "keep" });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://127.0.0.1:8080/runtimes/node/services/read.record-article/process",
    );
    vi.unstubAllGlobals();
  });
});
