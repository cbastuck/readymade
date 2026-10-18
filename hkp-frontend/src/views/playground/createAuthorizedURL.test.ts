import { describe, expect, it } from "vitest";

import { User } from "../../types";
import { createAuthorizedURL } from "./common";

/**
 * The user's token goes only to destinations on the allow list — never to a
 * third party a board happens to connect to.
 */

const user: User = { username: "u", userId: "u", idToken: "secret.id.token" };

describe("createAuthorizedURL", () => {
  it("leaves a third-party URL untouched", () => {
    const url = "wss://stream.data.alpaca.markets/v2/iex";
    expect(createAuthorizedURL(url, user)).toBe(url);
  });

  it("leaves the URL untouched without a user", () => {
    const url = "http://localhost:8555/socket";
    expect(createAuthorizedURL(url, null)).toBe(url);
  });

  it("adds the token for an allowed destination", () => {
    const url = createAuthorizedURL("http://localhost:8555/socket", user);
    expect(new URL(url).searchParams.get("token")).toBe("secret.id.token");
  });

  it("keeps an existing query when adding the token", () => {
    const url = new URL(
      createAuthorizedURL("http://localhost:8555/socket?a=1", user),
    );
    expect(url.searchParams.get("a")).toBe("1");
    expect(url.searchParams.get("token")).toBe("secret.id.token");
  });

  it("does not match the allowed host on another port", () => {
    const url = "http://localhost:8080/socket";
    expect(createAuthorizedURL(url, user)).toBe(url);
  });
});
