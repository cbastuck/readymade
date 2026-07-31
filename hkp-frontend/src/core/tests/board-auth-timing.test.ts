import { describe, expect, it, vi } from "vitest";

import { restoreBoard } from "../boardPersistence";
import type { BoardStateRefs } from "../boardContextTypes";
import type { User } from "../../types";

const asRef = <T,>(current: T) => ({ current });

const USER: User = {
  username: "alice",
  userId: "auth0|alice",
  features: [],
  picture: "",
  email: "alice@example.com",
  idToken: "id-token-abc",
} as User;

/**
 * Builds the refs bundle restoreBoard needs, with a restoreRuntime spy that
 * records the user it was handed — which is what decides whether the outbound
 * request carries an Authorization header.
 */
function makeRefs(options: {
  user: User | null;
  waitForAuthResolved?: () => Promise<User | null>;
}) {
  const restoreRuntime = vi.fn(async (runtime: any) => ({
    runtime,
    services: [],
    scope: {},
    registry: [],
  }));

  const refs = {
    userRef: asRef(options.user),
    appContextRef: options.waitForAuthResolved
      ? asRef({ waitForAuthResolved: options.waitForAuthResolved } as any)
      : undefined,
    boardNameRef: asRef("board"),
    propsRef: asRef({
      user: options.user,
      runtimeApis: { rest: { restoreRuntime }, browser: { restoreRuntime } },
    }),
  } as unknown as BoardStateRefs;

  return { refs, restoreRuntime };
}

const BOARD = {
  boardName: "b",
  runtimes: [{ id: "node", name: "Node", type: "rest", url: "http://h:8080" }],
  services: { node: [] },
} as any;

describe("board restore and auth timing", () => {
  it("waits for the session to settle before provisioning a remote runtime", async () => {
    // The cold-load case: Auth0 has a session, but restoring the ID token is
    // asynchronous, so `user` is still null when the board starts restoring.
    let releaseAuth: (user: User | null) => void = () => {};
    let markCalled: () => void = () => {};
    const waitWasCalled = new Promise<void>((resolve) => {
      markCalled = resolve;
    });
    const waitForAuthResolved = () =>
      new Promise<User | null>((resolve) => {
        releaseAuth = resolve;
        markCalled();
      });

    const { refs, restoreRuntime } = makeRefs({
      user: null,
      waitForAuthResolved,
    });

    const inFlight = restoreBoard(BOARD, refs, async () => {});

    // restoreBoard reaches the wait in a microtask, so synchronise on the call
    // itself rather than assuming it has happened.
    await waitWasCalled;
    expect(restoreRuntime).not.toHaveBeenCalled();

    releaseAuth(USER);
    await inFlight;

    // Provisioned with the restored user, so authHeaders() can sign the request.
    expect(restoreRuntime).toHaveBeenCalledTimes(1);
    expect(restoreRuntime.mock.calls[0][2]).toEqual(USER);
  });

  it("does not wait when the user is already in context", async () => {
    const waitForAuthResolved = vi.fn(async () => USER);
    const { refs, restoreRuntime } = makeRefs({
      user: USER,
      waitForAuthResolved,
    });

    await restoreBoard(BOARD, refs, async () => {});

    expect(waitForAuthResolved).not.toHaveBeenCalled();
    expect(restoreRuntime.mock.calls[0][2]).toEqual(USER);
  });

  it("does not wait for a board with no remote runtimes", async () => {
    // A purely local board must not be delayed by an auth flow it never uses.
    const waitForAuthResolved = vi.fn(async () => USER);
    const { refs, restoreRuntime } = makeRefs({
      user: null,
      waitForAuthResolved,
    });

    await restoreBoard(
      {
        boardName: "b",
        runtimes: [{ id: "ui", name: "UI", type: "browser" }],
        services: { ui: [] },
      } as any,
      refs,
      async () => {},
    );

    expect(waitForAuthResolved).not.toHaveBeenCalled();
    expect(restoreRuntime).toHaveBeenCalledTimes(1);
  });

  it("proceeds unauthenticated when no app context is available", async () => {
    // Hosts that build a partial refs bundle must still load the board rather
    // than hang waiting for a session nobody is going to resolve.
    const { refs, restoreRuntime } = makeRefs({ user: null });

    await restoreBoard(BOARD, refs, async () => {});

    expect(restoreRuntime).toHaveBeenCalledTimes(1);
    expect(restoreRuntime.mock.calls[0][2]).toBeNull();
  });
});
