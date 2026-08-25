import { afterEach, describe, expect, it } from "vitest";

import {
  redactSecrets,
  referencedSecrets,
  resolveSecrets,
  secretReference,
  secretStore,
  setSecretStore,
} from "../core/secrets";

/**
 * What a board is allowed to contain.
 *
 * A board names the secret it needs; the value belongs to whoever is running
 * the board. The two passes here are inverses, and the second one exists
 * because services do not agree on whether to hide what they were given.
 */

function storeOf(entries: Record<string, string>) {
  return {
    get: (alias: string) => entries[alias] ?? null,
    list: () => Object.keys(entries),
  };
}

afterEach(() => setSecretStore(null));

describe("resolving on load", () => {
  it("substitutes the value a board asked for by name", () => {
    const { value, missing } = resolveSecrets(
      { password: "{{secret.gmail}}" },
      storeOf({ gmail: "abcd efgh ijkl mnop" }),
    );

    expect(value).toEqual({ password: "abcd efgh ijkl mnop" });
    expect(missing).toEqual([]);
  });

  it("reaches a reference wherever it sits", () => {
    // A credential is as likely to be one entry in a header map as it is to
    // be a field of its own.
    const { value } = resolveSecrets(
      {
        headers: { Authorization: "Bearer {{secret.baserow}}" },
        pipeline: [{ state: { apiKey: "{{secret.hetzner}}" } }],
      },
      storeOf({ baserow: "brw-1", hetzner: "htz-2" }),
    );

    expect(value).toEqual({
      headers: { Authorization: "Bearer brw-1" },
      pipeline: [{ state: { apiKey: "htz-2" } }],
    });
  });

  it("leaves an unknown alias unset, and names it", () => {
    // Not left as the literal text: a service handed "{{secret.gmail}}" would
    // send it as a password and fail far away with an error naming nothing.
    const { value, missing } = resolveSecrets(
      { password: "{{secret.gmail}}" },
      storeOf({}),
    );

    expect(value).toEqual({ password: "" });
    expect(missing).toEqual(["gmail"]);
  });

  it("does not rebuild things that are not plain data", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const { value } = resolveSecrets({ bytes }, storeOf({}));

    expect(value.bytes).toBe(bytes);
  });

  it("lists what a board needs without resolving anything", () => {
    expect(
      referencedSecrets({
        a: "{{secret.one}}",
        b: ["{{ secret.two }}", "{{secret.one}}"],
      }),
    ).toEqual(["one", "two"]);
  });
});

describe("redacting on save", () => {
  it("puts the reference back where the value ended up", () => {
    // http-client reports `headers` exactly as configured. Without this, the
    // token resolved on load would be written into the board on the next save.
    const saved = redactSecrets(
      { headers: { Authorization: "Bearer brw-1" } },
      storeOf({ baserow: "brw-1" }),
    );

    expect(saved).toEqual({
      headers: { Authorization: `Bearer ${secretReference("baserow")}` },
    });
  });

  it("is the inverse of resolving", () => {
    const store = storeOf({ gmail: "app-password", baserow: "brw-1" });
    const board = {
      imap: { password: "{{secret.gmail}}" },
      http: { headers: { Authorization: "Bearer {{secret.baserow}}" } },
    };

    const { value: loaded } = resolveSecrets(board, store);
    expect(redactSecrets(loaded, store)).toEqual(board);
  });

  it("matches a longer secret before one contained in it", () => {
    const saved = redactSecrets(
      { key: "tok-abcdef" },
      storeOf({ short: "tok-abc", long: "tok-abcdef" }),
    );

    expect(saved).toEqual({ key: secretReference("long") });
  });

  it("leaves a board alone when nothing is stored", () => {
    const board = { headers: { Authorization: "Bearer public" } };
    expect(redactSecrets(board, storeOf({}))).toEqual(board);
  });
});

describe("the store a host registers", () => {
  it("resolves nothing until something is registered", () => {
    const { value, missing } = resolveSecrets({ k: "{{secret.x}}" });

    expect(value).toEqual({ k: "" });
    expect(missing).toEqual(["x"]);
  });

  it("uses whatever the host registered", () => {
    setSecretStore(storeOf({ x: "value" }));

    expect(secretStore().get("x")).toBe("value");
    expect(resolveSecrets({ k: "{{secret.x}}" }).value).toEqual({ k: "value" });
  });
});

describe("what an alias may be called", () => {
  it("accepts a dotted name", () => {
    // `secret.` is a fixed prefix and `}}` terminates, so there is exactly one
    // reading — and the app's older per-service vault writes dotted keys
    // (`<serviceUuid>.<field>`) that must be nameable the same way.
    const { value } = resolveSecrets(
      { a: "{{secret.gmail.imap}}", b: "{{secret.alpaca.apiKey}}" },
      storeOf({ "gmail.imap": "pw", "alpaca.apiKey": "sk-1" }),
    );

    expect(value).toEqual({ a: "pw", b: "sk-1" });
  });

  it("round-trips a dotted name back to its reference", () => {
    const store = storeOf({ "alpaca.apiKey": "sk-1" });
    expect(redactSecrets({ k: "sk-1" }, store)).toEqual({
      k: "{{secret.alpaca.apiKey}}",
    });
  });

  it("leaves a reference with no alias alone", () => {
    const { value, missing } = resolveSecrets({ k: "{{secret.}}" }, storeOf({}));

    expect(value).toEqual({ k: "{{secret.}}" });
    expect(missing).toEqual([]);
  });
});
