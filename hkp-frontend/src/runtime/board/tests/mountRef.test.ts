import { describe, expect, it } from "vitest";

import {
  formatMountRef,
  parseMountEndpoint,
  parseMountRef,
  resolveMountEndpoint,
  resolveMountRefsInBoard,
} from "../mountRef";

describe("mount references", () => {
  it("parses a runtime/service reference", () => {
    expect(parseMountRef("chat-node/peer-svc")).toEqual({
      runtimeId: "chat-node",
      serviceUuid: "peer-svc",
    });
  });

  it("keeps the service uuid intact when it contains slashes", () => {
    // Service ids are namespaced (hookup.to/service/...), so only the first
    // separator delimits the runtime.
    expect(parseMountRef("node/hookup.to/service/peer")).toEqual({
      runtimeId: "node",
      serviceUuid: "hookup.to/service/peer",
    });
  });

  it("treats malformed and empty references as absent", () => {
    for (const value of [null, undefined, "", "no-slash", "/leading", "trailing/"]) {
      expect(parseMountRef(value)).toBeNull();
    }
  });

  it("round-trips through formatMountRef", () => {
    const ref = { runtimeId: "node", serviceUuid: "svc-1" };
    expect(parseMountRef(formatMountRef(ref))).toEqual(ref);
  });
});

describe("mount endpoints", () => {
  it("splits a published URL into client connection parts", () => {
    expect(parseMountEndpoint("http://192.168.1.5:8080/hosted/abc123")).toEqual({
      host: "192.168.1.5",
      port: 8080,
      path: "/hosted/abc123",
      secure: false,
    });
  });

  it("applies scheme default ports and marks TLS", () => {
    expect(parseMountEndpoint("https://node.example.com/hosted/abc")).toEqual({
      host: "node.example.com",
      port: 443,
      path: "/hosted/abc",
      secure: true,
    });
  });

  it("strips a trailing slash so clients don't build a doubled path", () => {
    // PeerJS appends "/peerjs"; a trailing slash here would yield "//peerjs".
    expect(parseMountEndpoint("http://h:80/hosted/abc/")?.path).toBe(
      "/hosted/abc",
    );
  });

  it("returns null for absent or unparseable URLs", () => {
    expect(parseMountEndpoint(undefined)).toBeNull();
    expect(parseMountEndpoint("")).toBeNull();
    expect(parseMountEndpoint("not a url")).toBeNull();
  });
});

describe("resolveMountEndpoint", () => {
  const ref = { runtimeId: "chat-node", serviceUuid: "peer-svc" };

  it("reads the published url from the referenced service state", () => {
    const read = (runtimeId: string, serviceUuid: string) =>
      runtimeId === "chat-node" && serviceUuid === "peer-svc"
        ? { url: "http://127.0.0.1:8080/hosted/deadbeef" }
        : undefined;

    expect(resolveMountEndpoint(ref, read)).toEqual({
      host: "127.0.0.1",
      port: 8080,
      path: "/hosted/deadbeef",
      secure: false,
    });
  });

  it("resolves to null while the owning runtime has not published yet", () => {
    // Runtimes restore concurrently, so this is a normal transient state that
    // the caller retries — not a failure.
    expect(resolveMountEndpoint(ref, () => undefined)).toBeNull();
    expect(resolveMountEndpoint(ref, () => ({}))).toBeNull();
    expect(resolveMountEndpoint(ref, () => ({ url: "" }))).toBeNull();
  });

  it("resolves to null on hosts that cannot read across runtimes", () => {
    expect(resolveMountEndpoint(ref, undefined)).toBeNull();
  });

  it("resolves to null without a reference", () => {
    expect(resolveMountEndpoint(null, () => ({ url: "http://h/x" }))).toBeNull();
  });
});

describe("resolveMountRefsInBoard", () => {
  const liveState = (runtimeId: string, serviceUuid: string) =>
    runtimeId === "chat-node" && serviceUuid === "peer-svc"
      ? { url: "http://192.168.1.5:8080/hosted/abc123" }
      : undefined;

  /** A partner board: the runtime owning the peer server has been dropped. */
  const partnerBoard = () => ({
    runtimes: [{ id: "chat-browser", type: "browser" }],
    services: {
      "chat-browser": [
        {
          uuid: "peer-socket",
          serviceId: "hookup.to/service/peer-socket",
          state: { mode: "Receive and Send", peerMount: "chat-node/peer-svc" },
        },
      ],
    },
  });

  it("bakes a reference into concrete connection settings", () => {
    const out: any = resolveMountRefsInBoard(partnerBoard(), liveState);
    const state = out.services["chat-browser"][0].state;

    expect(state).toMatchObject({
      peerHost: "192.168.1.5",
      peerPort: 8080,
      peerPath: "/hosted/abc123",
      peerSecure: false,
    });
    // The reference is meaningless on the receiving device — it names a runtime
    // that board does not have — so it must not survive the export.
    expect(state.peerMount).toBeUndefined();
    expect(state.mode).toBe("Receive and Send");
  });

  it("does not mutate the board it was given", () => {
    const board = partnerBoard();
    resolveMountRefsInBoard(board, liveState);
    expect((board.services["chat-browser"][0].state as any).peerMount).toBe(
      "chat-node/peer-svc",
    );
  });

  it("leaves an unresolvable reference in place", () => {
    // Exported before the runtime came up: keep what the board asked for rather
    // than silently blanking it into an unconfigured socket.
    const out: any = resolveMountRefsInBoard(partnerBoard(), () => undefined);
    const state = out.services["chat-browser"][0].state;
    expect(state.peerMount).toBe("chat-node/peer-svc");
    expect(state.peerHost).toBeUndefined();
  });

  it("resolves references nested inside sub-service pipelines", () => {
    const board = {
      services: {
        ui: [
          {
            uuid: "sub",
            serviceId: "sub-service",
            state: {
              pipeline: [
                { instanceId: "inner", state: { peerMount: "chat-node/peer-svc" } },
              ],
            },
          },
        ],
      },
    };
    const out: any = resolveMountRefsInBoard(board, liveState);
    expect(out.services.ui[0].state.pipeline[0].state).toMatchObject({
      peerHost: "192.168.1.5",
      peerPort: 8080,
    });
  });

  it("marks a TLS endpoint secure", () => {
    const out: any = resolveMountRefsInBoard(partnerBoard(), () => ({
      url: "https://node.example.com/hosted/abc",
    }));
    expect(out.services["chat-browser"][0].state).toMatchObject({
      peerHost: "node.example.com",
      peerPort: 443,
      peerSecure: true,
    });
  });
});
