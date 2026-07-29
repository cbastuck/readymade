import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AppProvider, { useAppContext } from "../AppContext";

/** Mutable Auth0 state so each test can model a session or the lack of one. */
const auth0 = {
  isLoading: false,
  isAuthenticated: false,
  idToken: undefined as string | undefined,
};

vi.mock("@auth0/auth0-react", () => ({
  useAuth0: () => ({
    getIdTokenClaims: async () =>
      auth0.idToken ? { __raw: auth0.idToken } : undefined,
    isLoading: auth0.isLoading,
    isAuthenticated: auth0.isAuthenticated,
    logout: async () => {},
  }),
}));

vi.mock("sonner", () => ({
  toast: { info: () => {}, success: () => {}, error: () => {} },
}));

/** A minimal unsigned JWT carrying the claims processToken() reads. */
function fakeJwt(sub: string): string {
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `${b64({ alg: "none" })}.${b64({
    sub,
    email: `${sub}@example.com`,
    nickname: sub,
    picture: "",
    // validateToken() rejects a token with no exp and treats a past one as expired.
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.`;
}

type Captured = ReturnType<typeof useAppContext>;

function Capture({ onReady }: { onReady: (ctx: Captured) => void }) {
  onReady(useAppContext());
  return null;
}

function renderAppContext() {
  let ctx: Captured | null = null;
  render(
    <AppProvider>
      <Capture
        onReady={(value) => {
          ctx = value;
        }}
      />
    </AppProvider>,
  );
  return () => ctx!;
}

beforeEach(() => {
  auth0.isLoading = false;
  auth0.isAuthenticated = false;
  auth0.idToken = undefined;
});

describe("AppContext auth resolution", () => {
  it("resolves a pending waiter with the restored user", async () => {
    // Regression: updateToken() resolved synchronously alongside its deferred
    // state update, so resolution ran before the user existed and waiters were
    // handed null. Board restore then provisioned remote runtimes with no
    // credentials and every call came back 401.
    const raw = fakeJwt("alice");
    auth0.isAuthenticated = true;
    auth0.idToken = raw;

    const getCtx = renderAppContext();

    let resolved: string | undefined | null;
    await act(async () => {
      // Created before the session finishes restoring, exactly as board restore
      // does on a cold page load.
      const pending = getCtx().waitForAuthResolved();
      resolved = (await pending)?.idToken;
    });

    expect(resolved).toBe(raw);
    expect(getCtx().user?.idToken).toBe(raw);
  });

  it("resolves with null when nobody is signed in", async () => {
    // Must not hang: a board against a no-auth runtime has to load regardless.
    const getCtx = renderAppContext();

    let resolved: unknown;
    await act(async () => {
      resolved = await getCtx().waitForAuthResolved();
    });

    expect(resolved).toBeNull();
  });

  it("applies a token through updateToken", async () => {
    const getCtx = renderAppContext();
    const raw = fakeJwt("bob");

    await act(async () => {
      await getCtx().updateToken({ __raw: raw } as any);
    });

    expect(getCtx().user?.idToken).toBe(raw);
  });

  it("is a no-op for a token that is already applied", async () => {
    const getCtx = renderAppContext();
    const raw = fakeJwt("alice");

    await act(async () => {
      await getCtx().updateToken({ __raw: raw } as any);
    });
    const first = getCtx().user;
    expect(first?.idToken).toBe(raw);

    await act(async () => {
      await getCtx().updateToken({ __raw: raw } as any);
    });
    expect(getCtx().user).toBe(first);
  });
});
