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

/** Lets the watch run for `ms`, settling whatever it starts along the way. */
async function pass(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
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
  it("renews once the token is inside its lead time, not before", async () => {
    const { onToken } = renderRefresh(jwtExpiringIn(20 * 60));

    // Five minutes of lead time: fourteen minutes in, nothing has happened.
    await pass(14 * 60_000);
    expect(auth0.getAccessTokenSilently).not.toHaveBeenCalled();

    await pass(2 * 60_000);
    // cacheMode "off" is the part that matters: the cache is keyed to the
    // access token's lifetime, so anything else hands back the dying token.
    expect(auth0.getAccessTokenSilently).toHaveBeenCalledWith({
      cacheMode: "off",
    });
    expect(onToken).toHaveBeenCalledWith({ __raw: "renewed" });
  });

  it("renews immediately when the token is already within the lead time", async () => {
    renderRefresh(jwtExpiringIn(60));

    await pass(0);
    expect(auth0.getAccessTokenSilently).toHaveBeenCalled();
  });

  it("renews a token that expired while the machine slept", async () => {
    // What waking up looks like: the deadline is long past and nothing ran.
    const { onToken } = renderRefresh(jwtExpiringIn(-8 * 3600));

    await pass(0);
    expect(onToken).toHaveBeenCalledWith({ __raw: "renewed" });
  });

  it("tries again after a renewal fails", async () => {
    // A renewal at wake usually fails: the network is not back yet. One failure
    // must not be the end of renewing this session.
    auth0.getAccessTokenSilently.mockRejectedValueOnce(new Error("offline"));
    const { onToken } = renderRefresh(jwtExpiringIn(-3600));

    await pass(0);
    expect(auth0.getAccessTokenSilently).toHaveBeenCalledTimes(1);
    expect(onToken).not.toHaveBeenCalled();

    await pass(2 * 60_000);
    expect(onToken).toHaveBeenCalledWith({ __raw: "renewed" });
  });

  it("tries again as soon as the network comes back", async () => {
    auth0.getAccessTokenSilently.mockRejectedValueOnce(new Error("offline"));
    const { onToken } = renderRefresh(jwtExpiringIn(-3600));

    await pass(0);
    expect(onToken).not.toHaveBeenCalled();

    // The backoff earned while offline does not apply once it is back.
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(onToken).toHaveBeenCalledWith({ __raw: "renewed" });
  });

  it("waits longer each time a renewal changes nothing", async () => {
    const token = jwtExpiringIn(60);
    // A renewal that hands back the same token has renewed nothing; asking
    // again every minute would just be hammering Auth0.
    auth0.getIdTokenClaims.mockResolvedValue({ __raw: token });
    const { onToken } = renderRefresh(token);

    await pass(0);
    expect(auth0.getAccessTokenSilently).toHaveBeenCalledTimes(1);

    await pass(60_000);
    expect(auth0.getAccessTokenSilently).toHaveBeenCalledTimes(1);

    await pass(60_000);
    expect(auth0.getAccessTokenSilently).toHaveBeenCalledTimes(2);
    expect(onToken).not.toHaveBeenCalled();
  });

  it("renews through the host when the host owns the session", async () => {
    // The native app's token is not in the Auth0 cache, so the renewal goes to
    // the host — asking Auth0 there would mean a silent-auth iframe it rejects.
    const refreshSession = vi.fn(async () => "host-renewed");
    const { onToken } = renderRefresh(jwtExpiringIn(60), {
      restoreSession: async () => null,
      refreshSession,
    });

    await pass(0);
    expect(refreshSession).toHaveBeenCalled();
    expect(auth0.getAccessTokenSilently).not.toHaveBeenCalled();
    expect(onToken).toHaveBeenCalledWith({ __raw: "host-renewed" });
  });

  it("watches nothing for a host that owns the session and cannot renew it", async () => {
    // The mobile bridges return only an id_token: nothing to renew with, and
    // Auth0 must not be asked on their behalf.
    renderRefresh(jwtExpiringIn(60), { restoreSession: async () => null });

    await pass(10 * 60_000);
    expect(auth0.getAccessTokenSilently).not.toHaveBeenCalled();
  });

  it("applies nothing when the host's renewal comes back empty", async () => {
    const { onToken } = renderRefresh(jwtExpiringIn(60), {
      restoreSession: async () => null,
      refreshSession: async () => null,
    });

    await pass(0);
    expect(onToken).not.toHaveBeenCalled();
  });

  it("watches nothing when nobody is signed in", async () => {
    renderRefresh(undefined);

    await pass(10 * 60_000);
    expect(auth0.getAccessTokenSilently).not.toHaveBeenCalled();
  });
});
