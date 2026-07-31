import { describe, expect, it } from "vitest";

import {
  formatMountRef,
  parseMountEndpoint,
  parseMountRef,
  substituteMountsInBoard,
} from "../mount";

describe("mount references", () => {
  it("parses a runtime/service reference", () => {
    expect(parseMountRef("hkp-mount://chat-node/peer-svc")).toEqual({
      runtimeId: "chat-node",
      serviceUuid: "peer-svc",
    });
  });

  it("keeps the service uuid intact when it contains slashes", () => {
    // Service ids are namespaced (hookup.to/service/...), so only the first
    // separator delimits the runtime.
    expect(parseMountRef("hkp-mount://node/hookup.to/service/peer")).toEqual({
      runtimeId: "node",
      serviceUuid: "hookup.to/service/peer",
    });
  });

  it("preserves runtime id case", () => {
    // Parsed by hand rather than through URL, which would apply host syntax to
    // what is an opaque board identifier.
    expect(parseMountRef("hkp-mount://chatNode/peer-svc")?.runtimeId).toBe(
      "chatNode",
    );
  });

  it("treats malformed and empty references as absent", () => {
    for (const value of [
      null,
      undefined,
      "",
      "hkp-mount://no-slash",
      "hkp-mount:///leading",
      "hkp-mount://trailing/",
    ]) {
      expect(parseMountRef(value)).toBeNull();
    }
  });

  it("does not mistake an address for a reference", () => {
    // The scheme is what tells the two forms apart; a bare "a/b" would be
    // indistinguishable from a relative URL, which is why it is not accepted.
    expect(parseMountRef("http://192.168.1.5:8080/hosted/abc")).toBeNull();
    expect(parseMountRef("chat-node/peer-svc")).toBeNull();
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

describe("substituteMountsInBoard", () => {
  // Stands in for the coordinator, which is what resolves in production.
  const liveState = (value: string) =>
    value === "hkp-mount://chat-node/peer-svc"
      ? "http://192.168.1.5:8080/hosted/abc123"
      : null;

  /** A partner board: the runtime owning the peer server has been dropped. */
  const partnerBoard = () => ({
    runtimes: [{ id: "chat-browser", type: "browser" }],
    services: {
      "chat-browser": [
        {
          uuid: "peer-socket",
          serviceId: "hookup.to/service/peer-socket",
          state: {
            mode: "Receive and Send",
            __hkpMount: "hkp-mount://chat-node/peer-svc",
          },
        },
      ],
    },
  });

  it("replaces a reference with the address it resolves to", () => {
    const out: any = substituteMountsInBoard(partnerBoard(), liveState);
    const state = out.services["chat-browser"][0].state;

    // Same field, so the receiving service reads it exactly as it always does.
    // The reference itself is meaningless on the receiving device — it names a
    // runtime that board does not have — so it must not survive the export.
    expect(state.__hkpMount).toBe("http://192.168.1.5:8080/hosted/abc123");
    expect(state.mode).toBe("Receive and Send");
  });

  it("does not mutate the board it was given", () => {
    const board = partnerBoard();
    substituteMountsInBoard(board, liveState);
    expect((board.services["chat-browser"][0].state as any).__hkpMount).toBe(
      "hkp-mount://chat-node/peer-svc",
    );
  });

  it("leaves an unresolvable reference in place", () => {
    // Exported before the runtime came up: keep what the board asked for rather
    // than silently blanking it into an unconfigured socket.
    const out: any = substituteMountsInBoard(partnerBoard(), () => null);
    expect(out.services["chat-browser"][0].state.__hkpMount).toBe(
      "hkp-mount://chat-node/peer-svc",
    );
  });

  it("leaves an already-resolved address untouched", () => {
    // Re-exporting a board that was itself exported must not go looking for a
    // service named by an address.
    const board = {
      services: {
        ui: [{ uuid: "s", state: { __hkpMount: "http://h:80/hosted/abc" } }],
      },
    };
    const out: any = substituteMountsInBoard(board, liveState);
    expect(out.services.ui[0].state.__hkpMount).toBe("http://h:80/hosted/abc");
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
                {
                  instanceId: "inner",
                  state: { __hkpMount: "hkp-mount://chat-node/peer-svc" },
                },
              ],
            },
          },
        ],
      },
    };
    const out: any = substituteMountsInBoard(board, liveState);
    expect(out.services.ui[0].state.pipeline[0].state.__hkpMount).toBe(
      "http://192.168.1.5:8080/hosted/abc123",
    );
  });
});
