import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppCtx, AppContextState } from "../../../AppContext";
import { User } from "../../../types";
import { useRemotesFolder } from "../useRemotesFolder";
import { RemotesController } from "../types";

const USER: User = {
  username: "someone",
  userId: "auth0|1",
  features: [],
  picture: "",
  email: "someone@example.com",
  idToken: "token-abc",
};

const remotes: RemotesController = {
  runtimes: [{ name: "node", url: "https://node.example.com", type: "rest" }],
  onAdd: () => {},
  onRemove: () => {},
  onUpdate: () => {},
};

/** Context whose session has not settled: `user` is null, as it is on a cold
 *  page load, and the deferred resolves with the signed-in user later. */
function pendingAuthContext(settled: Promise<User | null>): AppContextState {
  return {
    user: null,
    appViewMode: "wide",
    pushNotification: () => {},
    popNotification: () => {},
    updateToken: async () => {},
    logout: () => {},
    waitForAuthResolved: () => settled,
  };
}

function wrapperFor(value: AppContextState) {
  return ({ children }: { children: React.ReactNode }) => (
    <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
  );
}

function authOf(call: [string, RequestInit]): string | undefined {
  return (call[1].headers as Record<string, string> | undefined)?.Authorization;
}

describe("useRemotesFolder auth timing", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ runtimes: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
  });

  it("waits for the session before listing a remote's runtimes", async () => {
    let resolveAuth!: (user: User | null) => void;
    const settled = new Promise<User | null>((r) => {
      resolveAuth = r;
    });
    renderHook(() => useRemotesFolder(remotes), {
      wrapper: wrapperFor(pendingAuthContext(settled)),
    });

    // Nothing goes out while auth is still resolving: a credential-less
    // request is a guaranteed 401, which fail2ban-fronted hosts count.
    expect(fetchMock).not.toHaveBeenCalled();

    resolveAuth(USER);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    for (const call of fetchMock.mock.calls) {
      expect(authOf(call as [string, RequestInit])).toBe(`Bearer ${USER.idToken}`);
    }
  });

  it("still fetches unauthenticated when nobody is signed in", async () => {
    renderHook(() => useRemotesFolder(remotes), {
      wrapper: wrapperFor(pendingAuthContext(Promise.resolve(null))),
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(authOf(fetchMock.mock.calls[0] as [string, RequestInit])).toBe(
      undefined,
    );
  });
});
