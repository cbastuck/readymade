import { afterEach, describe, expect, it, vi } from "vitest";

import {
  listCoordinatorParticipants,
  requestCoordinatorTickets,
  setCoordinatorBoardLogging,
} from "../coordinatorClient";

/**
 * What the coordinator client puts on the wire.
 *
 * Worth asserting rather than assuming: a request whose headers are *nearly*
 * right fails at the far end, as a body the server never parses, and the error
 * that surfaces says only "400" — nothing about the header that caused it.
 */

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function captureFetch(response: unknown = { logging: true, unreachable: [] }) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = vi.fn(async (url: any, init: any) => {
    calls.push({ url: String(url), init: init ?? {} });
    return {
      ok: true,
      status: 200,
      json: async () => response,
    } as Response;
  }) as unknown as typeof fetch;
  return calls;
}

describe("setCoordinatorBoardLogging", () => {
  it("sends exactly one content-type", async () => {
    // Two spellings of the same header in one object literal are two keys, and
    // Headers combines them into "application/json, application/json" — which a
    // JSON body parser does not match, so the body arrives unparsed.
    const calls = captureFetch();

    await setCoordinatorBoardLogging(
      "http://coordinator",
      "user-1",
      "token",
      "board-1",
      true,
    );

    const headers = new Headers(calls[0].init.headers);
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("carries the answer as a boolean the server can read", async () => {
    const calls = captureFetch();

    await setCoordinatorBoardLogging(
      "http://coordinator",
      "user-1",
      "token",
      "board-1",
      false,
    );

    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      enabled: false,
      level: "info",
    });
  });

  it("carries the level it was given", async () => {
    const calls = captureFetch();

    await setCoordinatorBoardLogging(
      "http://coordinator",
      "user-1",
      "token",
      "board-1",
      true,
      "debug",
    );

    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      enabled: true,
      level: "debug",
    });
  });

  it("addresses the board it was given", async () => {
    const calls = captureFetch();

    await setCoordinatorBoardLogging(
      "http://coordinator",
      "user with space",
      "token",
      "board/one",
      true,
    );

    expect(calls[0].url).toBe(
      "http://coordinator/users/user%20with%20space/boards/board%2Fone/logging",
    );
  });

  it("authorises as the user", async () => {
    const calls = captureFetch();

    await setCoordinatorBoardLogging(
      "http://coordinator",
      "user-1",
      "the-token",
      "board-1",
      true,
    );

    const headers = new Headers(calls[0].init.headers);
    expect(headers.get("authorization")).toBe("Bearer the-token");
  });

  it("reports a refusal rather than returning a bad answer", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(
      setCoordinatorBoardLogging(
        "http://coordinator",
        "user-1",
        "token",
        "board-1",
        true,
      ),
    ).rejects.toThrow("400");
  });
});

describe("asking for tickets", () => {
  it("names the board and its runtimes, as the person", async () => {
    const calls = captureFetch({ tickets: { node: "hkpt_a", py: "hkpt_b" } });

    const tickets = await requestCoordinatorTickets(
      "http://coordinator",
      "auth0|user 1",
      "token",
      "My board",
      ["node", "py"],
    );

    expect(tickets).toEqual({ node: "hkpt_a", py: "hkpt_b" });
    expect(calls[0].url).toBe(
      "http://coordinator/users/auth0%7Cuser%201/boards/My%20board/tickets",
    );
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      runtimeIds: ["node", "py"],
    });
    expect(new Headers(calls[0].init.headers).get("authorization")).toBe(
      "Bearer token",
    );
  });

  it("says the coordinator needs updating when it has no such route", async () => {
    // One that still dials: it would take the board and then fail to reach
    // every runtime in it. Better said before anything is handed over.
    globalThis.fetch = vi.fn(
      async () => ({ ok: false, status: 404 }) as Response,
    ) as unknown as typeof fetch;

    await expect(
      requestCoordinatorTickets("http://coordinator", "u", "t", "b", ["node"]),
    ).rejects.toThrow(/needs updating/);
  });

  it("fails on any other refusal rather than carrying on without tickets", async () => {
    globalThis.fetch = vi.fn(
      async () => ({ ok: false, status: 403 }) as Response,
    ) as unknown as typeof fetch;

    await expect(
      requestCoordinatorTickets("http://coordinator", "u", "t", "b", ["node"]),
    ).rejects.toThrow(/403/);
  });
});

describe("listing a board's participants", () => {
  it("reads who holds a ticket and who is connected", async () => {
    const participants = [
      { runtimeId: "node", connected: true, server: "node", issuedAt: "x" },
    ];
    const calls = captureFetch({ participants });

    expect(
      await listCoordinatorParticipants("http://coordinator", "u", "t", "b"),
    ).toEqual(participants);
    expect(calls[0].url).toBe("http://coordinator/users/u/boards/b/participants");
  });
});
