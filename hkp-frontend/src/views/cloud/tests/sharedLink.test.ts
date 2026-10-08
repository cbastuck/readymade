import { afterEach, describe, expect, it, vi } from "vitest";

import {
  bridgeUrlFor,
  coordinatorNameFor,
  createSharedBoardLink,
  findKnownCoordinator,
  readSharedBoardLink,
} from "../sharedLink";

/**
 * A link to a shared board names a coordinator, and so names somewhere a
 * client would send the person's sign-in. What is pinned here is that it
 * carries nothing but names, and that "do I already keep this coordinator" has
 * one answer.
 */

const LINK = {
  coordinatorUrl: "https://node1.example.com/coordinator",
  owner: "auth0|owner",
  boardName: "Court booking",
};

describe("a shared board link", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads back what it was made from", () => {
    const made = createSharedBoardLink(LINK);

    expect(new URL(made).origin).toBe("https://readymadeit.com");
    expect(readSharedBoardLink(new URL(made).search)).toEqual(LINK);
  });

  it("uses the hosted frontend even when made in the native app", () => {
    (globalThis as any).__MEANDER_CONFIG__ = {
      lanIp: "192.168.1.5",
      frontendPort: 9090,
      apiPort: 8887,
    };
    try {
      expect(new URL(createSharedBoardLink(LINK)).origin).toBe(
        "https://readymadeit.com",
      );
    } finally {
      delete (globalThis as any).__MEANDER_CONFIG__;
    }
  });

  it("uses the configured local website origin for a development build", () => {
    vi.stubEnv("VITE_MEMBER_WEBAPP_ORIGIN", "http://localhost:4000/");
    const made = createSharedBoardLink(LINK);

    expect(new URL(made).origin).toBe("http://localhost:4000");
    expect(readSharedBoardLink(new URL(made).search)).toEqual(LINK);
  });

  it("does not choose a local frontend from the coordinator's scheme", () => {
    const made = createSharedBoardLink({
      ...LINK,
      coordinatorUrl: "http://127.0.0.1:8080/coordinator",
    });
    expect(new URL(made).origin).toBe("https://readymadeit.com");
  });

  it("carries names and nothing else", () => {
    const query = new URL(createSharedBoardLink(LINK)).searchParams;

    expect([...query.keys()].sort()).toEqual(["board", "owner", "shared"]);
  });

  it("is not one when a part is missing or the coordinator is not an address", () => {
    expect(readSharedBoardLink("")).toBeNull();
    expect(readSharedBoardLink("?shared=https://x.example/coordinator")).toBeNull();
    expect(
      readSharedBoardLink("?shared=not-a-url&owner=o&board=b"),
    ).toBeNull();
    expect(
      readSharedBoardLink("?shared=javascript:alert(1)&owner=o&board=b"),
    ).toBeNull();
  });
});

describe("whether a coordinator is one the person keeps", () => {
  const kept = [{ name: "Club", url: "https://node1.example.com/coordinator" }];

  it("matches the address however it is spelled", () => {
    expect(
      findKnownCoordinator(kept, "https://NODE1.example.com/coordinator/"),
    ).toBe(kept[0]);
  });

  it("does not match another host, or another path on the same one", () => {
    expect(
      findKnownCoordinator(kept, "https://node1.example.com.evil.example/coordinator"),
    ).toBeUndefined();
    expect(
      findKnownCoordinator(kept, "https://node1.example.com/other"),
    ).toBeUndefined();
  });
});

describe("a coordinator's addresses", () => {
  it("names one nobody named by its host", () => {
    expect(coordinatorNameFor("https://node1.example.com:8443/coordinator")).toBe(
      "node1.example.com:8443",
    );
  });

  it("finds its bridge", () => {
    expect(bridgeUrlFor("https://node1.example.com/coordinator")).toBe(
      "wss://node1.example.com/coordinator/bridge",
    );
    expect(bridgeUrlFor("http://127.0.0.1:8080/coordinator/")).toBe(
      "ws://127.0.0.1:8080/coordinator/bridge",
    );
  });
});
