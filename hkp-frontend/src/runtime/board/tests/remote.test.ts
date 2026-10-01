import { describe, expect, it, vi } from "vitest";

import {
  RuntimeAddressingError,
  addressingOf,
  authoredAddressing,
  bakeAddressing,
  normalizeKind,
  remoteNameFromUrl,
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

const kinds: Record<string, string> = {
  Laptop: "node",
  Studio: "python",
  "Other python": "python",
};
const probe = vi.fn(async (remote: { name: string }) => ({
  kind: kinds[remote.name],
}));

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
    expect(addressingOf({ id: "a", requires: { kind: "python" } })).toEqual({
      mode: "requires",
      requires: { kind: "python" },
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
    [{ id: "a", url: "http://h:1", requires: { kind: "node" } }],
    [{ id: "a", remote: "Laptop", requires: { kind: "node" } }],
    // The legacy spelling is a name, so it cannot sit beside another one.
    [{ id: "a", url: "hkp://remotes/local", remote: "Laptop" }],
  ])("refuses a runtime that says it more than once: %j", (runtime) => {
    expect(() => addressingOf(runtime)).toThrow(RuntimeAddressingError);
    expect(() => addressingOf(runtime)).toThrow(/more than once/);
  });

  it("refuses a requirement that is not an object naming a kind", () => {
    // A bare string would be an opaque label that stops matching the moment
    // anything about the server changes, and could not grow a second key.
    expect(() => addressingOf({ id: "a", requires: "python" })).toThrow(
      /must be an object/,
    );
    expect(() => addressingOf({ id: "a", requires: {} })).toThrow(
      RuntimeAddressingError,
    );
    expect(() => addressingOf({ id: "a", remote: "" })).toThrow(
      RuntimeAddressingError,
    );
  });

  it("spells hkp-rt's kind the way a board does", () => {
    expect(normalizeKind("c++")).toBe("cpp");
    expect(normalizeKind(" Python ")).toBe("python");
    expect(normalizeKind(undefined)).toBeUndefined();
    expect(addressingOf({ id: "a", requires: { kind: "C++" } })).toEqual({
      mode: "requires",
      requires: { kind: "cpp" },
    });
  });
});

describe("resolving a runtime's address on this client", () => {
  it("uses an authored address as it is, asking nobody", async () => {
    probe.mockClear();
    const resolution = await resolveRuntimeAddress(
      { id: "a", url: "http://h:1" },
      remotes,
      probe,
    );

    expect(resolution).toEqual({ ok: true, url: "http://h:1", mode: "url" });
    expect(probe).not.toHaveBeenCalled();
  });

  it("looks a name up among this client's remotes", async () => {
    expect(
      await resolveRuntimeAddress({ id: "a", remote: "Studio" }, remotes, probe),
    ).toEqual({
      ok: true,
      url: "http://studio.local:5000",
      mode: "remote",
      remoteName: "Studio",
    });
  });

  it("does not resolve a name this client does not hold, and has no fallback", async () => {
    const resolution = await resolveRuntimeAddress(
      { id: "a", remote: "Someone else's" },
      remotes,
      probe,
    );

    expect(resolution.ok).toBe(false);
    expect(resolution).toMatchObject({ reason: "unknown-remote" });
    expect((resolution as { message: string }).message).toMatch(
      /Someone else's/,
    );
  });

  it("does not resolve a name to a remote that has no address", async () => {
    const resolution = await resolveRuntimeAddress(
      { id: "a", remote: "Browser Runtime" },
      remotes,
      probe,
    );

    expect(resolution).toMatchObject({ ok: false, reason: "unknown-remote" });
  });

  it("leaves the legacy spelling to the host that serves it", async () => {
    expect(
      await resolveRuntimeAddress(
        { id: "a", url: "hkp://remotes/local" },
        [],
        probe,
      ),
    ).toEqual({
      ok: true,
      url: "hkp://remotes/local",
      mode: "remote",
      remoteName: "local",
    });
  });

  it("places a requirement on the first remote of that kind, in the client's order", async () => {
    // Two python servers: refusing would make "any python" boards unusable for
    // exactly the people best equipped to run them.
    expect(
      await resolveRuntimeAddress(
        { id: "a", requires: { kind: "python" } },
        remotes,
        probe,
      ),
    ).toEqual({
      ok: true,
      url: "http://studio.local:5000",
      mode: "requires",
      remoteName: "Studio",
    });
  });

  it("chooses by the client's order, not by which server answers first", async () => {
    const slowFirst = vi.fn(async (remote: { name: string }) => {
      if (remote.name === "Studio") {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return { kind: kinds[remote.name] };
    });

    const resolution = await resolveRuntimeAddress(
      { id: "a", requires: { kind: "python" } },
      remotes,
      slowFirst,
    );

    expect(resolution).toMatchObject({ remoteName: "Studio" });
  });

  it("matches hkp-rt, which calls itself c++, for a board asking for cpp", async () => {
    const resolution = await resolveRuntimeAddress(
      { id: "a", requires: { kind: "cpp" } },
      [{ name: "RT", type: "rest", url: "http://rt:8887" }],
      async () => ({ kind: "c++" }),
    );

    expect(resolution).toMatchObject({ ok: true, remoteName: "RT" });
  });

  it("passes over a remote that cannot be asked", async () => {
    const resolution = await resolveRuntimeAddress(
      { id: "a", requires: { kind: "python" } },
      remotes,
      async (remote) => {
        if (remote.name === "Studio") {
          throw new Error("down");
        }
        return { kind: kinds[remote.name] };
      },
    );

    expect(resolution).toMatchObject({ ok: true, remoteName: "Other python" });
  });

  it("says so when no remote is of the kind asked for", async () => {
    const resolution = await resolveRuntimeAddress(
      { id: "a", requires: { kind: "go" } },
      remotes,
      probe,
    );

    expect(resolution).toMatchObject({ ok: false, reason: "no-match" });
  });

  it("throws rather than resolves a runtime that says it twice", async () => {
    await expect(
      resolveRuntimeAddress(
        { id: "a", url: "http://evil.example", remote: "Nope" },
        remotes,
        probe,
      ),
    ).rejects.toThrow(RuntimeAddressingError);
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
    expect(
      authoredAddressing({
        id: "a",
        requires: { kind: "python" },
        url: "http://studio.local:5000",
      }),
    ).toEqual({ requires: { kind: "python" } });
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

  it("drops a requirement the same way", () => {
    expect(
      bakeAddressing({
        id: "a",
        requires: { kind: "python" },
        url: "http://studio.local:5000",
      }),
    ).toEqual({ id: "a", url: "http://studio.local:5000" });
  });

  it("leaves an authored address as it is", () => {
    expect(bakeAddressing({ id: "a", url: "http://h:1" })).toEqual({
      id: "a",
      url: "http://h:1",
    });
  });
});
