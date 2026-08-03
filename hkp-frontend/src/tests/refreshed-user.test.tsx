import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RefreshedUser from "../RefreshedUser";
import { PlatformProvider } from "../platform/PlatformContext";
import type { PlatformCapabilities } from "../platform/PlatformContext";

const auth0 = {
  getIdTokenClaims: vi.fn(),
  getAccessTokenSilently: vi.fn(),
};

vi.mock("@auth0/auth0-react", () => ({
  useAuth0: () => auth0,
}));

/** A JWT that expires `seconds` from now. Only `exp` is ever read. */
function jwtExpiringIn(seconds: number): string {
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `${b64({ alg: "none" })}.${b64({
    exp: Math.floor(Date.now() / 1000) + seconds,
  })}.`;
}

function renderRefresh(
  idToken: string | undefined,
  platform: PlatformCapabilities = {},
) {
  const onToken = vi.fn();
  render(
    <PlatformProvider value={platform}>
      <RefreshedUser idToken={idToken} onToken={onToken} />
    </PlatformProvider>,
  );
  return { onToken };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  auth0.getIdTokenClaims.mockResolvedValue({ __raw: "renewed" });
  auth0.getAccessTokenSilently.mockResolvedValue("access-1");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RefreshedUser", () => {
  it("renews shortly before the token expires, not after", async () => {
    const { onToken } = renderRefresh(jwtExpiringIn(60));

    // Ten seconds of lead time: at 49s nothing has happened yet.
    await act(async () => {
      vi.advanceTimersByTime(49_000);
    });
    expect(auth0.getAccessTokenSilently).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    // cacheMode "off" is the part that matters: the cache is keyed to the
    // access token's lifetime, so anything else hands back the dying token.
    expect(auth0.getAccessTokenSilently).toHaveBeenCalledWith({
      cacheMode: "off",
    });
    expect(onToken).toHaveBeenCalledWith({ __raw: "renewed" });
  });

  it("renews immediately when the token is already within the lead time", async () => {
    renderRefresh(jwtExpiringIn(3));

    await act(async () => {
      vi.advanceTimersByTime(0);
    });
    expect(auth0.getAccessTokenSilently).toHaveBeenCalled();
  });

  it("renews through the host when the host owns the session", async () => {
    // The native app's token is not in the Auth0 cache, so the renewal goes to
    // the host — asking Auth0 there would mean a silent-auth iframe it rejects.
    const refreshSession = vi.fn(async () => "host-renewed");
    const { onToken } = renderRefresh(jwtExpiringIn(60), {
      restoreSession: async () => null,
      refreshSession,
    });

    await act(async () => {
      vi.advanceTimersByTime(51_000);
    });
    expect(refreshSession).toHaveBeenCalled();
    expect(auth0.getAccessTokenSilently).not.toHaveBeenCalled();
    expect(onToken).toHaveBeenCalledWith({ __raw: "host-renewed" });
  });

  it("schedules nothing for a host that owns the session and cannot renew it", async () => {
    // The mobile bridges return only an id_token: nothing to renew with, and
    // Auth0 must not be asked on their behalf.
    renderRefresh(jwtExpiringIn(60), { restoreSession: async () => null });

    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });
    expect(auth0.getAccessTokenSilently).not.toHaveBeenCalled();
  });

  it("applies nothing when the host's renewal comes back empty", async () => {
    const { onToken } = renderRefresh(jwtExpiringIn(60), {
      restoreSession: async () => null,
      refreshSession: async () => null,
    });

    await act(async () => {
      vi.advanceTimersByTime(51_000);
    });
    expect(onToken).not.toHaveBeenCalled();
  });

  it("schedules nothing when nobody is signed in", async () => {
    renderRefresh(undefined);

    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });
    expect(auth0.getAccessTokenSilently).not.toHaveBeenCalled();
  });

  it("survives a failed renewal without applying anything", async () => {
    auth0.getAccessTokenSilently.mockRejectedValue(new Error("login required"));
    const { onToken } = renderRefresh(jwtExpiringIn(60));

    await act(async () => {
      vi.advanceTimersByTime(51_000);
    });
    expect(onToken).not.toHaveBeenCalled();
  });
});
