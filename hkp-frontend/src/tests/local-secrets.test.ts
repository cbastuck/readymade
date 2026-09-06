import { afterEach, describe, expect, it } from "vitest";

import {
  SecretStore,
  THIS_DEVICE,
  resolveCredential,
  setSecretStore,
  withSecrets,
} from "hkp-frontend/src/core/secrets";

/**
 * Credentials that are used without being sent anywhere.
 *
 * A passphrase an Encrypt service derives a key from, or a key Sign computes an
 * HMAC with, never leaves the process. There is no host to name, but naming a
 * destination is what makes an audience able to constrain anything — so these
 * name `THIS_DEVICE`, which behaves as an ordinary audience entry and matches
 * no host at all. A secret learned there is a secret that stays there.
 */

function storeOf(
  entries: Record<string, { value: string; audience?: string[] }>,
): SecretStore {
  return {
    get: (alias) => entries[alias]?.value ?? null,
    audience: (alias) => entries[alias]?.audience ?? null,
    list: () => Object.keys(entries),
  };
}

afterEach(() => setSecretStore(null));

describe("a destination that is not a host", () => {
  it("resolves a secret nothing constrains", () => {
    setSecretStore(storeOf({ pass: { value: "hunter2" } }));

    expect(resolveCredential("{{secret.pass}}", THIS_DEVICE)).toEqual({
      value: "hunter2",
      problem: "",
    });
  });

  it("resolves one pinned to this device", () => {
    setSecretStore(
      storeOf({ pass: { value: "hunter2", audience: [THIS_DEVICE] } }),
    );

    expect(resolveCredential("{{secret.pass}}", THIS_DEVICE).value).toBe(
      "hunter2",
    );
  });

  it("refuses one bound to a host", () => {
    setSecretStore(
      storeOf({ pass: { value: "hunter2", audience: ["api.example.com"] } }),
    );

    const { value, problem } = resolveCredential("{{secret.pass}}", THIS_DEVICE);
    expect(value).toBeUndefined();
    expect(problem).toBe("pass may only be sent to api.example.com");
  });

  it("refuses a device-pinned secret to any host, including a wildcard", () => {
    setSecretStore(
      storeOf({ pass: { value: "hunter2", audience: [THIS_DEVICE] } }),
    );

    expect(
      resolveCredential("{{secret.pass}}", "https://api.github.com").problem,
    ).toBe("pass may not be sent to api.github.com");
    expect(resolveCredential("{{secret.pass}}", "https://x.example").problem).toBe(
      "pass may not be sent to x.example",
    );
  });

  it("is what a first local use records", () => {
    const learned: Array<[string, string]> = [];
    setSecretStore({
      ...storeOf({ pass: { value: "hunter2" } }),
      learn: (alias, host) => learned.push([alias, host]),
    });

    withSecrets("{{secret.pass}}", { to: THIS_DEVICE });
    expect(learned).toEqual([["pass", THIS_DEVICE]]);
  });
});

describe("resolveCredential", () => {
  it("passes a literal through, so a board that names no secret still works", () => {
    setSecretStore(storeOf({}));

    expect(resolveCredential("secret key 123", THIS_DEVICE)).toEqual({
      value: "secret key 123",
      problem: "",
    });
  });

  it("says which alias has nothing behind it", () => {
    setSecretStore(storeOf({}));

    expect(resolveCredential("{{secret.gh}}", "https://api.github.com")).toEqual(
      { value: undefined, problem: "no value stored for gh" },
    );
  });

  it("resolves nothing at all when one part of a structure is refused", () => {
    setSecretStore(
      storeOf({
        good: { value: "fine" },
        bound: { value: "hunter2", audience: ["api.example.com"] },
      }),
    );

    // Half a filled-in structure is the dangerous answer: a caller handed one
    // may send it, having asked for something it did not get.
    const { value, problem } = resolveCredential(
      { a: "{{secret.good}}", b: "{{secret.bound}}" },
      "https://evil.example",
    );
    expect(value).toBeUndefined();
    expect(problem).toBe("bound may not be sent to evil.example");
  });

  it("resolves a credential embedded in a larger string", () => {
    setSecretStore(storeOf({ gh: { value: "ghp_x" } }));

    expect(
      resolveCredential("token {{secret.gh}}", "https://api.github.com").value,
    ).toBe("token ghp_x");
  });
});
