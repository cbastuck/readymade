import { afterEach, describe, expect, it, vi } from "vitest";

import RuntimeRestScope from "../RuntimeRestScope";
import { authenticatedSocketUrl, ticketUrlFor } from "../wsTicket";
import { RuntimeDescriptor } from "../../../types";

/**
 * A WebSocket is opened with a ticket the token bought, never with the token
 * in its address (wsTicket.ts).
 */

const answer = (status: number, body: unknown = {}) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the address of an authenticated socket", () => {
  it("carries a ticket the token bought, asked for with the token in a header", async () => {
    const fetchMock = answer(200, { ticket: "t-1", expiresInMs: 30000 });
    vi.stubGlobal("fetch", fetchMock);

    const url = await authenticatedSocketUrl(
      "wss://rt.example/node/rt-1",
      ticketUrlFor("https://rt.example/node/"),
      "the-token",
    );

    expect(url).toBe("wss://rt.example/node/rt-1?ticket=t-1");
    expect(url).not.toContain("the-token");
    expect(fetchMock).toHaveBeenCalledWith("https://rt.example/node/ws-tickets", {
      method: "POST",
      headers: { Authorization: "Bearer the-token" },
    });
  });

  it("carries the token itself only for a server that issues no tickets", async () => {
    vi.stubGlobal("fetch", answer(404));
    expect(await authenticatedSocketUrl("ws://old.example/rt", "http://old.example/ws-tickets", "tok")).toBe(
      "ws://old.example/rt?access_token=tok",
    );
  });

  it("carries nothing when a ticket was refused or could not be asked for", async () => {
    vi.stubGlobal("fetch", answer(401));
    expect(await authenticatedSocketUrl("ws://a.example/rt", "http://a.example/ws-tickets", "tok")).toBe(
      "ws://a.example/rt",
    );
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await authenticatedSocketUrl("ws://a.example/rt", "http://a.example/ws-tickets", "tok")).toBe(
      "ws://a.example/rt",
    );
  });

  it("asks for nothing without a token", async () => {
    const fetchMock = answer(200, { ticket: "t" });
    vi.stubGlobal("fetch", fetchMock);
    expect(await authenticatedSocketUrl("ws://a.example/rt", "http://a.example/ws-tickets", null)).toBe(
      "ws://a.example/rt",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("a remote runtime's socket", () => {
  const runtime = { id: "rt-1", name: "Node", type: "rest", url: "http://127.0.0.1:8080" } as RuntimeDescriptor;
  const user = { idToken: "the-token" } as never;

  class FakeSocket {
    static opened: string[] = [];
    onmessage = null;
    onopen = null;
    onerror = null;
    readyState = 0;
    constructor(readonly url: string) {
      FakeSocket.opened.push(url);
    }
    send() {}
    close() {}
  }

  it("is opened with a ticket", async () => {
    FakeSocket.opened = [];
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubGlobal("fetch", answer(200, { ticket: "t-2" }));

    new RuntimeRestScope(runtime, "ws://127.0.0.1:8080/rt-1", user);

    await vi.waitFor(() => expect(FakeSocket.opened).toEqual(["ws://127.0.0.1:8080/rt-1?ticket=t-2"]));
  });

  it("is never opened once the scope was closed while its ticket was coming", async () => {
    FakeSocket.opened = [];
    vi.stubGlobal("WebSocket", FakeSocket);
    let release: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (release = resolve))));

    const scope = new RuntimeRestScope(runtime, "ws://127.0.0.1:8080/rt-1", user);
    await scope.close();
    release(new Response(JSON.stringify({ ticket: "t-3" }), { status: 200 }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(FakeSocket.opened).toEqual([]);
  });
});
