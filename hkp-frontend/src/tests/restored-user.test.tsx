import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RestoredUser from "../RestoredUser";

const auth0 = {
  isLoading: false,
  isAuthenticated: true,
  getIdTokenClaims: vi.fn(),
  getAccessTokenSilently: vi.fn(),
  logout: vi.fn(),
};

vi.mock("@auth0/auth0-react", () => ({
  useAuth0: () => auth0,
}));

const expired = () => Object.assign(new Error("token expired"), {});

function renderRestore(onToken: (claims: any) => void | Promise<void>) {
  const onResolved = vi.fn();
  const onError = vi.fn();
  render(
    <RestoredUser
      onToken={onToken}
      onResolved={onResolved}
      onError={onError}
    />,
  );
  return { onResolved, onError };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth0.isLoading = false;
  auth0.isAuthenticated = true;
  auth0.getIdTokenClaims.mockResolvedValue({ __raw: "tok-1" });
  auth0.getAccessTokenSilently.mockResolvedValue("access-1");
  auth0.logout.mockResolvedValue(undefined);
});

describe("RestoredUser", () => {
  it("applies the cached token when it is still valid", async () => {
    const onToken = vi.fn();
    let handles!: ReturnType<typeof renderRestore>;
    await act(async () => {
      handles = renderRestore(onToken);
    });

    expect(onToken).toHaveBeenCalledWith({ __raw: "tok-1" });
    expect(auth0.getAccessTokenSilently).not.toHaveBeenCalled();
    expect(handles.onError).not.toHaveBeenCalled();
    expect(handles.onResolved).toHaveBeenCalled();
  });

  it("renews an expired token and keeps the user signed in", async () => {
    // The session behind an aged-out token is usually still good, so a renewal
    // should keep the user working rather than signing them out.
    const onToken = vi
      .fn()
      .mockRejectedValueOnce(expired())
      .mockResolvedValueOnce(undefined);

    let handles!: ReturnType<typeof renderRestore>;
    await act(async () => {
      handles = renderRestore(onToken);
    });

    expect(auth0.getAccessTokenSilently).toHaveBeenCalledWith({
      cacheMode: "off",
    });
    expect(onToken).toHaveBeenCalledTimes(2);
    expect(auth0.logout).not.toHaveBeenCalled();
    expect(handles.onError).not.toHaveBeenCalled();
  });

  it("reports and signs out when renewal fails", async () => {
    const onToken = vi.fn().mockRejectedValue(expired());
    auth0.getAccessTokenSilently.mockRejectedValue(new Error("login required"));

    let handles!: ReturnType<typeof renderRestore>;
    await act(async () => {
      handles = renderRestore(onToken);
    });

    expect(handles.onError).toHaveBeenCalledTimes(1);
    expect(handles.onError.mock.calls[0][0]).toMatch(/sign in again/i);
    expect(auth0.logout).toHaveBeenCalledWith({ openUrl: false });
    // Waiters must still be released, or board load hangs behind a dead session.
    expect(handles.onResolved).toHaveBeenCalled();
  });

  it("reports an unexpected failure without claiming the session expired", async () => {
    const onToken = vi.fn().mockRejectedValue(new Error("malformed claims"));

    let handles!: ReturnType<typeof renderRestore>;
    await act(async () => {
      handles = renderRestore(onToken);
    });

    // Not an expiry, so no renewal attempt — that would only mask the fault.
    expect(auth0.getAccessTokenSilently).not.toHaveBeenCalled();
    expect(handles.onError.mock.calls[0][0]).toMatch(/malformed claims/);
    expect(handles.onResolved).toHaveBeenCalled();
  });

  it("resolves without a token when nobody is signed in", async () => {
    auth0.isAuthenticated = false;
    const onToken = vi.fn();

    let handles!: ReturnType<typeof renderRestore>;
    await act(async () => {
      handles = renderRestore(onToken);
    });

    expect(onToken).not.toHaveBeenCalled();
    expect(handles.onError).not.toHaveBeenCalled();
    expect(handles.onResolved).toHaveBeenCalled();
  });

  it("waits while the session is still loading", async () => {
    auth0.isLoading = true;
    const onToken = vi.fn();

    let handles!: ReturnType<typeof renderRestore>;
    await act(async () => {
      handles = renderRestore(onToken);
    });

    expect(onToken).not.toHaveBeenCalled();
    // Nothing is known yet, so committing to an outcome would be premature.
    expect(handles.onResolved).not.toHaveBeenCalled();
  });
});
