import { describe, expect, it } from "vitest";

import {
  formatMountRef,
  parseMountEndpoint,
  parseMountRef,
  resolveMountEndpoint,
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
