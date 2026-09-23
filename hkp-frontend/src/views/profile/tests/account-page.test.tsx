import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { loadProfile } from "hkp-frontend/src/core/userProfile";

/**
 * The account page.
 *
 * The two halves it shows are not the same kind of thing: the identity comes
 * signed in the OIDC id_token and is read-only, the profile beside it is the
 * app's own and is editable. Both claims are checked here, because the page
 * only makes sense if the split holds.
 */

const logout = vi.fn();

vi.mock("hkp-frontend/src/auth/useCloudLogin", () => ({
  useCloudLogin: () => vi.fn(),
  useCanCloudLogin: () => true,
}));
vi.mock("hkp-frontend/src/auth/useCloudLogout", () => ({
  useCloudLogout: () => logout,
}));

let currentUser: any = null;
vi.mock("hkp-frontend/src/AppContext", () => ({
  useAppContext: () => ({ user: currentUser }),
}));

/** A JWT carrying these claims. Unsigned: the page decodes what a session was
 *  established with and never verifies it — that happened at sign-in. */
function idTokenWith(claims: Record<string, unknown>): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${encode({ alg: "RS256" })}.${encode(claims)}.signature`;
}

const SUB = "google-oauth2|1234567890";

const idToken = idTokenWith({
  sub: SUB,
  name: "Ada Lovelace",
  nickname: "ada",
  email: "ada@example.com",
  email_verified: true,
  iss: "https://hookitapp.eu.auth0.com/",
  exp: Math.floor(Date.now() / 1000) + 3600,
});

// Imported after the mocks are registered, so the page sees them.
const { default: AccountPage } = await import("../AccountPage");

describe("AccountPage", () => {
  beforeEach(() => {
    localStorage.clear();
    currentUser = {
      username: "ada",
      userId: SUB,
      email: "ada@example.com",
      idToken,
    };
  });

  it("shows the identity the id_token asserts", () => {
    render(<AccountPage />);

    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getAllByText("ada@example.com").length).toBeGreaterThan(0);
    expect(screen.getByText(SUB)).toBeTruthy();
    expect(screen.getByText("https://hookitapp.eu.auth0.com/")).toBeTruthy();
    // Which connection signed this person in, read out of the subject.
    expect(screen.getByText("google-oauth2")).toBeTruthy();
  });

  it("stores an edited profile against the user and overrides the token's name", () => {
    render(<AccountPage />);

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Ada L." },
    });
    fireEvent.click(screen.getByText("Save"));

    expect(loadProfile(SUB)).toEqual({ displayName: "Ada L." });
    // The heading follows the stored profile rather than the token's nickname.
    expect(screen.getByText("Ada L.")).toBeTruthy();
  });

  it("keeps one user's profile out of another's", () => {
    const { unmount } = render(<AccountPage />);
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Ada L." },
    });
    fireEvent.click(screen.getByText("Save"));
    unmount();

    currentUser = { username: "bob", userId: "auth0|other", idToken: idTokenWith({ sub: "auth0|other" }) };
    render(<AccountPage />);

    expect((screen.getByLabelText("Display name") as HTMLInputElement).value).toBe("");
  });

  it("offers signing out, which the avatar no longer does", () => {
    render(<AccountPage />);

    fireEvent.click(screen.getByText("Sign out"));

    expect(logout).toHaveBeenCalled();
  });

  it("asks a signed-out visitor to sign in instead of showing an empty account", () => {
    currentUser = null;
    render(<AccountPage />);

    expect(screen.getByText("Nobody is signed in")).toBeTruthy();
    expect(screen.queryByText("Identity")).toBeNull();
  });
});
