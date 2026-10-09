import { describe, expect, it } from "vitest";

import {
  RuntimeAddressingError,
  addressingOf,
  authoredAddressing,
  bakeAddressing,
  remoteNameFromUrl,
  EMBEDDED_REMOTE_NAME,
  embeddedRemote,
  resolveRuntimeAddress,
} from "../remote";

/**
 * How a board says which runtime server a runtime belongs on.
 *
 * The rule under most of this is that a runtime says it exactly once. A name
 * resolves differently for everyone, so a board that could also carry an
 * address to fall back on would give whoever wrote it two tries at making a
 * client dial something.
 */

const remotes = [
  { name: "Browser Runtime", type: "browser" },
  { name: "Laptop", type: "rest", url: "http://127.0.0.1:8080" },
  { name: "Studio", type: "rest", url: "http://studio.local:5000" },
  { name: "Other python", type: "rest", url: "http://other.local:5000" },
];

describe("reading a runtime's addressing", () => {
  it("reads each of the three ways a runtime says where it runs", () => {
    expect(addressingOf({ id: "a", url: "http://h:1" })).toEqual({
      mode: "url",
      url: "http://h:1",
    });
    expect(addressingOf({ id: "a", remote: "Laptop" })).toEqual({
      mode: "remote",
      name: "Laptop",
    });
    expect(addressingOf({ id: "a" })).toEqual({ mode: "none" });
  });

  it("reads hkp://remotes/<name> as a name, not as an address", () => {
    expect(addressingOf({ id: "a", url: "hkp://remotes/local" })).toEqual({
      mode: "remote",
      name: "local",
      legacyUrl: "hkp://remotes/local",
    });
    expect(remoteNameFromUrl("hkp://remotes/local/runtimes/x")).toBe("local");
    expect(remoteNameFromUrl("http://remotes/local")).toBeUndefined();
  });

  it.each([
    [{ id: "a", url: "http://h:1", remote: "Laptop" }],
    // The legacy spelling is a name, so it cannot sit beside another one.
    [{ id: "a", url: "hkp://remotes/local", remote: "Laptop" }],
  ])("refuses a runtime that says it more than once: %j", (runtime) => {
    expect(() => addressingOf(runtime)).toThrow(RuntimeAddressingError);
    expect(() => addressingOf(runtime)).toThrow(/more than once/);
  });

  it("refuses a name that is empty", () => {
    expect(() => addressingOf({ id: "a", remote: "" })).toThrow(
      RuntimeAddressingError,
    );
  });
});

describe("resolving a runtime's address on this client", () => {
  it("uses an authored address as it is", () => {
    const resolution = resolveRuntimeAddress(
      { id: "a", url: "http://h:1" },
      remotes,
    );

    expect(resolution).toEqual({ ok: true, url: "http://h:1", mode: "url" });
  });

  it("looks a name up among this client's remotes", () => {
    expect(
      resolveRuntimeAddress({ id: "a", remote: "Studio" }, remotes),
    ).toEqual({
      ok: true,
      url: "http://studio.local:5000",
      mode: "remote",
      remoteName: "Studio",
    });
  });

  it("does not resolve a name this client does not hold, and has no fallback", () => {
    const resolution = resolveRuntimeAddress(
      { id: "a", remote: "Someone else's" },
      remotes,
    );

    expect(resolution.ok).toBe(false);
    expect(resolution).toMatchObject({ reason: "unknown-remote" });
    expect((resolution as { message: string }).message).toMatch(
      /Someone else's/,
    );
  });

  it("does not resolve a name to a remote that has no address", () => {
    const resolution = resolveRuntimeAddress(
      { id: "a", remote: "Browser Runtime" },
      remotes,
    );

    expect(resolution).toMatchObject({ ok: false, reason: "unknown-remote" });
  });

  it("leaves the legacy spelling to the host that serves it", () => {
    expect(
      resolveRuntimeAddress({ id: "a", url: "hkp://remotes/local" }, []),
    ).toEqual({
      ok: true,
      url: "hkp://remotes/local",
      mode: "remote",
      remoteName: "local",
    });
  });

  it("places nothing the board did not name", () => {
    // Saying only what kind of server would do names no server: this client
    // does not pick one of its remotes on a board's behalf.
    const resolution = resolveRuntimeAddress(
      { id: "a", requires: { kind: "python" } } as { id: string },
      remotes,
    );

    expect(resolution).toMatchObject({ ok: false, reason: "none" });
  });

  it("throws rather than resolves a runtime that says it twice", () => {
    expect(() =>
      resolveRuntimeAddress(
        { id: "a", url: "http://evil.example", remote: "Nope" },
        remotes,
      ),
    ).toThrow(RuntimeAddressingError);
  });
});

describe("the runtime a host embeds", () => {
  // What each app lists for its own runtime: its own name for it, and an
  // address only the app itself can serve.
  const desktop = [
    { name: "meander-cpp", type: "rest", url: "hkp://remotes/meander-cpp" },
    ...remotes,
  ];
  const phone = [
    { name: "meander-ios", type: "rest", url: "hkp://remotes/meander-ios" },
  ];
  const board = { id: "rt", remote: EMBEDDED_REMOTE_NAME };

  it("is what the name resolves to, whatever the app calls it", () => {
    expect(resolveRuntimeAddress(board, desktop)).toEqual({
      ok: true,
      url: "hkp://remotes/meander-cpp",
      mode: "remote",
      remoteName: "meander-cpp",
    });
    expect(resolveRuntimeAddress(board, phone)).toMatchObject({
      ok: true,
      url: "hkp://remotes/meander-ios",
    });
  });

  it("is found by how it is reached, not by where it stands in the list", () => {
    expect(embeddedRemote([...remotes, desktop[0]])).toBe(desktop[0]);
    expect(embeddedRemote(remotes)).toBeUndefined();
  });

  it("wins over a server somebody keeps under the same name", () => {
    // A board asking for the app's own runtime must not land elsewhere.
    const withImpostor = [
      { name: "embedded", type: "rest", url: "http://elsewhere.example:8887" },
      ...desktop,
    ];

    expect(resolveRuntimeAddress(board, withImpostor)).toMatchObject({
      ok: true,
      url: "hkp://remotes/meander-cpp",
    });
  });

  it("is a name like any other where nothing is embedded", () => {
    // A browser tab: the person may call a server of theirs by it.
    const browser = [
      ...remotes,
      { name: "embedded", type: "rest", url: "http://127.0.0.1:8887" },
    ];

    expect(resolveRuntimeAddress(board, browser)).toEqual({
      ok: true,
      url: "http://127.0.0.1:8887",
      mode: "remote",
      remoteName: "embedded",
    });
  });

  it("does not resolve where there is none, and says what was wanted", () => {
    const resolution = resolveRuntimeAddress(board, remotes);

    expect(resolution).toMatchObject({ ok: false, reason: "unknown-remote" });
    expect((resolution as { message: string }).message).toContain(
      "the runtime the Readymade app embeds",
    );
  });

  it("is still reached by the name its app gives it, in either spelling", () => {
    expect(
      resolveRuntimeAddress({ id: "rt", remote: "meander-cpp" }, desktop),
    ).toMatchObject({ ok: true, url: "hkp://remotes/meander-cpp" });
    expect(
      resolveRuntimeAddress(
        { id: "rt", url: "hkp://remotes/meander-cpp" },
        desktop,
      ),
    ).toMatchObject({ ok: true, url: "hkp://remotes/meander-cpp" });
  });

  it("is kept as the name when the board is saved", () => {
    expect(
      authoredAddressing({
        id: "rt",
        remote: EMBEDDED_REMOTE_NAME,
        url: "hkp://remotes/meander-cpp",
      }),
    ).toEqual({ remote: EMBEDDED_REMOTE_NAME });
  });
});

describe("what a saved board gets", () => {
  it("keeps the name and drops the address it resolved to", () => {
    expect(
      authoredAddressing({
        id: "a",
        remote: "Studio",
        url: "http://studio.local:5000",
      }),
    ).toEqual({ remote: "Studio" });
  });

  it("keeps an authored address", () => {
    expect(authoredAddressing({ id: "a", url: "http://h:1" })).toEqual({
      url: "http://h:1",
    });
  });
});

describe("what an exported runtime gets", () => {
  it("carries the address its name resolved to, and not the name", () => {
    // The receiver has no way to resolve a name that was this client's.
    const baked = bakeAddressing({
      id: "a",
      name: "Node",
      remote: "Studio",
      url: "http://studio.local:5000",
    });

    expect(baked).toEqual({
      id: "a",
      name: "Node",
      url: "http://studio.local:5000",
    });
    // Still says where it runs exactly once, so it loads wherever it lands.
    expect(addressingOf(baked)).toEqual({
      mode: "url",
      url: "http://studio.local:5000",
    });
  });

  it("leaves an authored address as it is", () => {
    expect(bakeAddressing({ id: "a", url: "http://h:1" })).toEqual({
      id: "a",
      url: "http://h:1",
    });
  });
});
