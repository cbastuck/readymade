import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AppProvider, { useAppContext } from "../AppContext";
import { PlatformProvider } from "../platform/PlatformContext";
import type { PlatformCapabilities } from "../platform/PlatformContext";

// No Auth0 session in any of these: the point is the host-owned one.
const auth0 = { isLoading: false, isAuthenticated: false };
vi.mock("@auth0/auth0-react", () => ({
  useAuth0: () => ({
    getIdTokenClaims: async () => undefined,
    getAccessTokenSilently: async () => "",
    isLoading: auth0.isLoading,
    isAuthenticated: auth0.isAuthenticated,
    logout: async () => {},
  }),
}));

vi.mock("sonner", () => ({
  toast: { info: () => {}, success: () => {}, error: () => {} },
}));

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
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.`;
}

type Captured = ReturnType<typeof useAppContext>;

function Capture({ onReady }: { onReady: (ctx: Captured) => void }) {
  onReady(useAppContext());
  return null;
}

function renderWithPlatform(capabilities: PlatformCapabilities) {
  let ctx: Captured | null = null;
  render(
    <PlatformProvider value={capabilities}>
      <AppProvider>
        <Capture
          onReady={(value) => {
            ctx = value;
          }}
        />
      </AppProvider>
    </PlatformProvider>,
  );
  return () => ctx!;
}

beforeEach(() => {
  auth0.isLoading = false;
  auth0.isAuthenticated = false;
});

describe("platform session restore", () => {
  it("restores a host-owned session on load", async () => {
    // Regression: a native login's token lives nowhere the Auth0 client can see,
    // so without this path a reload signed the user out and every authenticated
    // runtime call started failing with a 401.
    const raw = fakeJwt("alice");
    const getCtx = renderWithPlatform({
      restoreSession: async () => raw,
    });

    let resolved: string | undefined;
    await act(async () => {
      resolved = (await getCtx().waitForAuthResolved())?.idToken;
    });

    expect(resolved).toBe(raw);
    expect(getCtx().user?.idToken).toBe(raw);
  });

  it("waits for the platform restore before declaring auth resolved", async () => {
    // The Auth0 restorer settles immediately here (no web session). If that alone
    // resolved the gate, a caller would proceed unauthenticated while the host
    // session was still loading — the exact bug the gate exists to prevent.
    const raw = fakeJwt("bob");
    let releasePlatform!: (token: string | null) => void;
    const getCtx = renderWithPlatform({
      restoreSession: () =>
        new Promise<string | null>((resolve) => {
          releasePlatform = resolve;
        }),
    });

    let settled = false;
    await act(async () => {
      void getCtx()
        .waitForAuthResolved()
        .then(() => {
          settled = true;
        });
      await Promise.resolve();
    });
    expect(settled).toBe(false);

    await act(async () => {
      releasePlatform(raw);
      // Applying the token is deferred through a timer, so let it run before
      // asserting that the gate opened.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(settled).toBe(true);
    expect(getCtx().user?.idToken).toBe(raw);
  });

  it("resolves with null when the host has no stored session", async () => {
    const getCtx = renderWithPlatform({ restoreSession: async () => null });

    let resolved: unknown;
    await act(async () => {
      resolved = await getCtx().waitForAuthResolved();
    });

    expect(resolved).toBeNull();
  });

  it("resolves on a host without the capability", async () => {
    // Plain web: only the Auth0 restorer participates, so the gate must not wait
    // for a second one that will never report.
    const getCtx = renderWithPlatform({});

    let resolved: unknown;
    await act(async () => {
      resolved = await getCtx().waitForAuthResolved();
    });

    expect(resolved).toBeNull();
  });

  it("still resolves when the host restore throws", async () => {
    const getCtx = renderWithPlatform({
      restoreSession: async () => {
        throw new Error("keychain unavailable");
      },
    });

    let resolved: unknown;
    await act(async () => {
      resolved = await getCtx().waitForAuthResolved();
    });

    // A broken restore is a signed-out start, not a board that never loads.
    expect(resolved).toBeNull();
  });
});
