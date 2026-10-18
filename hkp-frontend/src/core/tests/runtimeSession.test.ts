import { describe, expect, it, vi } from "vitest";

import { addRuntime, updateRuntime } from "../runtimeOperations";
import { withoutSession } from "../../types";
import type { BoardStateRefs } from "../boardContextTypes";

/**
 * Who is signed in is this client's to know, not the runtime's to carry.
 *
 * A runtime descriptor is shaped like a document — it is what a saved runtime
 * file holds, what the configuration dialog shows, what a custom action sends
 * to another runtime — and for as long as it carried the signed-in user, it
 * carried their sign-in token into all three. The token is the scope's
 * (`authenticatedUser`); a descriptor is given none, and one read back from a
 * file saved before this does not keep it.
 */

const SIGNED_IN = {
  username: "anna",
  userId: "auth0|anna",
  features: {},
  idToken: "eyJ.secret.token",
};

function refsWith(runtimes: unknown[], api: Record<string, unknown>) {
  const state = { runtimes: [...runtimes] };
  const apply = <T>(prev: T, next: T | ((prev: T) => T)) =>
    typeof next === "function" ? (next as (p: T) => T)(prev) : next;
  return {
    state,
    refs: {
      runtimesRef: { current: state.runtimes },
      scopesRef: { current: { rt: { setState: vi.fn() } } },
      propsRef: { current: { runtimeApis: { rest: api } } },
      userRef: { current: SIGNED_IN },
      boardNameRef: { current: "Board" },
      availableRuntimeEnginesRef: { current: [] },
      setRuntimes: vi.fn((next) => (state.runtimes = apply(state.runtimes, next))),
      setServices: vi.fn(),
      setRegistry: vi.fn(),
      setScopes: vi.fn(),
    } as unknown as BoardStateRefs,
  };
}

describe("a runtime and the person signed in", () => {
  it("is put on the board without them", async () => {
    const api = {
      addRuntime: vi.fn(async () => ({
        runtime: { id: "rt", name: "Node", type: "rest", url: "http://127.0.0.1:8080" },
        services: [],
        registry: [],
        scope: {},
      })),
    };
    const { refs, state } = refsWith([], api);

    const added = await addRuntime(
      { name: "Node", type: "rest", url: "http://127.0.0.1:8080" } as never,
      refs,
      async () => {},
    );

    // Still created as them: the api is told who is asking.
    expect(api.addRuntime).toHaveBeenCalledWith(expect.anything(), SIGNED_IN, "Board");
    expect(added).not.toHaveProperty("user");
    expect(JSON.stringify(state.runtimes)).not.toContain(SIGNED_IN.idToken);
  });

  it("does not come back with a runtime saved when descriptors carried them", async () => {
    const runtime = { id: "rt", name: "Node", type: "rest", url: "http://127.0.0.1:8080" };
    const api = { configureService: vi.fn(async () => ({})) };
    const { refs, state } = refsWith([runtime], api);

    await updateRuntime(
      "rt",
      { runtime: { ...runtime, user: SIGNED_IN } as never, services: [] },
      refs,
    );

    expect(state.runtimes).toEqual([runtime]);
  });

  it("is left out of anything a descriptor is written into", () => {
    const saved = {
      id: "rt",
      name: "Node",
      type: "rest",
      state: { color: "#fff" },
      user: SIGNED_IN,
    };
    expect(withoutSession(saved)).toEqual({
      id: "rt",
      name: "Node",
      type: "rest",
      state: { color: "#fff" },
    });
    expect(JSON.stringify(withoutSession(saved))).not.toContain(SIGNED_IN.idToken);
  });
});
