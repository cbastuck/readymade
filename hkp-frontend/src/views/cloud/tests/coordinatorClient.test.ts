import { afterEach, describe, expect, it, vi } from "vitest";

import { setCoordinatorBoardLogging } from "../coordinatorClient";

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
