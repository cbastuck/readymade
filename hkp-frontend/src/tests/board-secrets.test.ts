import { afterEach, describe, expect, it } from "vitest";

import {
  destinationHost,
  referencedSecrets,
  secretReference,
  secretStore,
  setSecretStore,
  unavailableSecrets,
  withSecrets,
} from "../core/secrets";

/**
 * What a board is allowed to contain, and what it takes to get a value out.
 *
 * A board names the secret it needs; the value belongs to whoever is running
 * the board and is produced only for one use, at the moment of that use. There
 * is no inverse pass: nothing ever writes a value into the state a board is
 * saved from.
 */

function storeOf(
  entries: Record<string, string | { value: string; audience: string[] }>,
) {
  const entry = (alias: string) => {
    const found = entries[alias];
    if (found === undefined) {
      return null;
    }
    return typeof found === "string" ? { value: found, audience: [] } : found;
  };
  return {
    get: (alias: string) => entry(alias)?.value ?? null,
    audience: (alias: string) => entry(alias)?.audience ?? null,
    list: () => Object.keys(entries),
  };
}

afterEach(() => setSecretStore(null));

describe("resolving for one use", () => {
  it("substitutes the value a board asked for by name", () => {
    const { value, missing } = withSecrets(
      { host: "imap.example.com", password: "{{secret.mail}}" },
      { to: "imap.example.com" },
      storeOf({ mail: "hunter2" }),
    );

    expect(value).toEqual({ host: "imap.example.com", password: "hunter2" });
    expect(missing).toEqual([]);
  });

  it("substitutes inside a larger string and anywhere in a structure", () => {
    const { value } = withSecrets(
      { headers: { Authorization: "Bearer {{secret.api}}" }, tags: ["{{secret.api}}"] },
      { to: "https://api.example.com/v1/messages" },
      storeOf({ api: "sk-1" }),
    );

    expect(value).toEqual({
      headers: { Authorization: "Bearer sk-1" },
      tags: ["sk-1"],
    });
  });

  it("tolerates whitespace and treats dots as part of the alias", () => {
    const { value } = withSecrets(
      { a: "{{ secret.gmail.imap }}" },
      { to: "imap.gmail.com" },
      storeOf({ "gmail.imap": "v" }),
    );

    expect(value).toEqual({ a: "v" });
  });

  it("resolves an alias it does not hold to empty, and names it", () => {
    const { value, missing } = withSecrets(
      { password: "{{secret.absent}}" },
      { to: "example.com" },
      storeOf({}),
    );

    expect(value).toEqual({ password: "" });
    expect(missing).toEqual(["absent"]);
  });

  it("leaves values that are not plain JSON alone", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const { value } = withSecrets({ bytes }, { to: "example.com" }, storeOf({}));

    expect(value.bytes).toBe(bytes);
  });

  it("uses the registered store when none is passed", () => {
    setSecretStore(storeOf({ x: "value" }));

    expect(secretStore().get("x")).toBe("value");
    expect(withSecrets({ k: "{{secret.x}}" }, { to: "example.com" }).value).toEqual({
      k: "value",
    });
  });

  it("resolves to empty with no store registered", () => {
    const { value, missing } = withSecrets(
      { k: "{{secret.x}}" },
      { to: "example.com" },
    );

    expect(value).toEqual({ k: "" });
    expect(missing).toEqual(["x"]);
  });

  it("ignores a reference with no alias", () => {
    const { value, missing } = withSecrets(
      { k: "{{secret.}}" },
      { to: "example.com" },
      storeOf({}),
    );

    expect(value).toEqual({ k: "{{secret.}}" });
    expect(missing).toEqual([]);
  });
});

describe("a destination is required", () => {
  it("refuses to resolve without one", () => {
    const store = storeOf({ mail: "hunter2" });

    expect(() =>
      withSecrets({ p: "{{secret.mail}}" }, { to: "" }, store),
    ).toThrow(/destination/);
    expect(() =>
      withSecrets({ p: "{{secret.mail}}" }, undefined as any, store),
    ).toThrow(/destination/);
  });

  it("reads the host out of whatever shape the caller holds", () => {
    expect(destinationHost("https://api.example.com/v1?q=1")).toBe("api.example.com");
    expect(destinationHost("imap.example.com:993")).toBe("imap.example.com");
    expect(destinationHost("API.Example.COM")).toBe("api.example.com");
    expect(destinationHost("  example.com  ")).toBe("example.com");
    expect(destinationHost("")).toBe(null);
    expect(destinationHost(undefined)).toBe(null);
  });
});

describe("audience", () => {
  it("releases a secret to a host the store allows", () => {
    const { value, refused } = withSecrets(
      { h: "Bearer {{secret.slack}}" },
      { to: "https://hooks.slack.com/services/x" },
      storeOf({ slack: { value: "xoxb", audience: ["hooks.slack.com"] } }),
    );

    expect(value).toEqual({ h: "Bearer xoxb" });
    expect(refused).toEqual([]);
  });

  it("withholds it from anywhere else, and says so", () => {
    const { value, refused } = withSecrets(
      { h: "Bearer {{secret.slack}}" },
      { to: "https://evil.example/?p=1" },
      storeOf({ slack: { value: "xoxb", audience: ["hooks.slack.com"] } }),
    );

    expect(value).toEqual({ h: "Bearer " });
    expect(refused).toEqual([
      { alias: "slack", to: "evil.example", audience: ["hooks.slack.com"] },
    ]);
  });

  it("treats an entry with no audience as unconstrained", () => {
    const { value, refused } = withSecrets(
      { h: "{{secret.any}}" },
      { to: "https://anywhere.example" },
      storeOf({ any: { value: "v", audience: [] } }),
    );

    expect(value).toEqual({ h: "v" });
    expect(refused).toEqual([]);
  });

  it("matches a subdomain wildcard but not the bare domain", () => {
    const store = storeOf({ k: { value: "v", audience: ["*.example.com"] } });

    expect(withSecrets({ k: "{{secret.k}}" }, { to: "api.example.com" }, store).value)
      .toEqual({ k: "v" });
    expect(withSecrets({ k: "{{secret.k}}" }, { to: "example.com" }, store).refused)
      .toHaveLength(1);
  });
});

describe("what a board carries", () => {
  it("names every alias a board refers to, however nested", () => {
    expect(
      referencedSecrets({
        a: "{{secret.one}}",
        b: [{ c: "x {{secret.two}} y" }],
        d: "{{secret.one}}",
      }).sort(),
    ).toEqual(["one", "two"]);
  });

  it("says which of them the store cannot supply", () => {
    expect(
      unavailableSecrets(
        { a: "{{secret.held}}", b: "{{secret.absent}}" },
        storeOf({ held: "v" }),
      ),
    ).toEqual(["absent"]);
  });

  it("round-trips a board unchanged, because nothing is ever substituted into it", () => {
    const board = {
      services: {
        ui: [{ uuid: "a", state: { url: "https://api.example.com", key: "{{secret.api}}" } }],
      },
    };
    const store = storeOf({ api: "sk-1" });

    // What a service holds is what a board saves. Using the secret produces a
    // separate value that never goes back into state.
    const used = withSecrets(board, { to: "api.example.com" }, store);
    expect(used.value).not.toEqual(board);
    expect(board.services.ui[0].state.key).toBe(secretReference("api"));
  });
});
