import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCloudLogout } from "../auth/useCloudLogout";
import { PlatformProvider } from "../platform/PlatformContext";
import type { PlatformCapabilities } from "../platform/PlatformContext";
import AppProvider from "../AppContext";

const auth0Logout = vi.fn();

vi.mock("@auth0/auth0-react", () => ({
  useAuth0: () => ({
    getIdTokenClaims: async () => undefined,
    getAccessTokenSilently: async () => "",
    isLoading: false,
    isAuthenticated: false,
    logout: auth0Logout,
  }),
}));

vi.mock("sonner", () => ({
  toast: { info: () => {}, success: () => {}, error: () => {} },
}));

function renderLogout(capabilities: PlatformCapabilities) {
  let logout!: () => Promise<void>;
  function Harness() {
    logout = useCloudLogout();
    return null;
  }
  render(
    <PlatformProvider value={capabilities}>
      <AppProvider>
        <Harness />
      </AppProvider>
    </PlatformProvider>,
  );
  return () => logout();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cloud logout", () => {
  it("ends the Auth0 session, not just the local one", async () => {
    // Regression: a local-only logout leaves the identity provider's SSO cookie
    // in place, so the next login skips the credentials form and goes straight
    // to consent for the same account — making it impossible to sign in as
    // anyone else, which is exactly what testing two users requires.
    const logout = renderLogout({});

    await act(async () => {
      await logout();
    });

    expect(auth0Logout).toHaveBeenCalledTimes(1);
    const args = auth0Logout.mock.calls[0][0];
    expect(args?.openUrl).not.toBe(false);
    expect(args?.logoutParams?.returnTo).toBe(window.location.origin);
  });

  it("defers to the platform when it owns the session", async () => {
    // The native webview logs out through its own flow; redirecting there would
    // navigate away from the app.
    const platformLogout = vi.fn(async () => {});
    const logout = renderLogout({ logout: platformLogout });

    await act(async () => {
      await logout();
    });

    expect(platformLogout).toHaveBeenCalledTimes(1);
    expect(auth0Logout).not.toHaveBeenCalled();
  });

  it("clears the app user even when the provider logout fails", async () => {
    // A failed provider call must not leave the app looking signed in.
    const logout = renderLogout({
      logout: async () => {
        throw new Error("network down");
      },
    });

    await act(async () => {
      await expect(logout()).rejects.toThrow("network down");
    });
  });
});
