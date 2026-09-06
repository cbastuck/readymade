import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SecretRelease,
  allowedSecrets,
  grantKey,
  readGrantKey,
  resetSecretConsent,
  setSecretConsent,
} from "hkp-frontend/src/core/secretConsent";

/**
 * Where a remembered answer lives, and what it is remembered against.
 *
 * A grant is not a credential, but it is what stands between a board and one:
 * anything that can write one can have a secret handed over without being
 * asked. So the host keeps them, injecting a copy the page reads before any
 * board loads — provisioning starts as soon as one does, and a grant arriving a
 * moment later would be a question asked again for something already answered.
 */

/** A fresh copy of the grants module, reading whatever the host injected. */
async function loadGrants(injected: unknown) {
  vi.resetModules();
  (window as any).__HKP_GRANTS__ = injected;
  return import("hkp-frontend/src/grants");
}

const release = (over: Partial<SecretRelease> = {}): SecretRelease => ({
  boardName: "Mail",
  runtimeId: "node",
  url: "http://127.0.0.1:8080",
  aliases: ["gmail.imap"],
  ...over,
});

afterEach(() => {
  delete (window as any).__HKP_GRANTS__;
  resetSecretConsent();
});

describe("the key a grant is remembered against", () => {
  it("survives a board named like a separator", () => {
    // Why it is a JSON array and not joined text: these two are different
    // triples and must never collapse into one key.
    expect(grantKey(release({ boardName: "Mail node" }))).not.toBe(
      grantKey(release({ boardName: "Mail", runtimeId: "node x" })),
    );
  });

  it("reads back into the parts it was made from", () => {
    expect(readGrantKey(grantKey(release()))).toEqual({
      boardName: "Mail",
      runtimeId: "node",
      origin: "http://127.0.0.1:8080",
    });
  });

  it("says nothing for a key it did not make", () => {
    expect(readGrantKey("Mail node http://x")).toBeNull();
    expect(readGrantKey('["Mail","node"]')).toBeNull();
    expect(readGrantKey('["Mail","node",7]')).toBeNull();
  });

  it("names an unsaved board rather than leaving it blank", () => {
    expect(readGrantKey(grantKey(release({ boardName: "" })))?.boardName).toBe(
      "(unsaved)",
    );
  });
});

describe("reading what the host injected", () => {
  it("takes a grant it can use", async () => {
    const key = grantKey(release());
    const grants = await loadGrants({ [key]: ["gmail.imap"] });

    expect(grants.grantedAliases(key)).toEqual(["gmail.imap"]);
  });

  it("drops an entry that is not a list of names", async () => {
    const grants = await loadGrants({ a: "gmail.imap", b: [1, 2], c: [] });

    expect(grants.allGrants()).toEqual({});
  });

  it("is empty on a host that injected nothing", async () => {
    const grants = await loadGrants(undefined);

    expect(grants.allGrants()).toEqual({});
    expect(grants.grantedAliases("anything")).toEqual([]);
  });
});

describe("the store the consent gate uses", () => {
  it("skips the question for something the host already remembered", async () => {
    const key = grantKey(release());
    const grants = await loadGrants({ [key]: ["gmail.imap"] });
    const prompt = vi.fn(async () => ({ allowed: [], remember: false }));
    setSecretConsent({ prompt, grants: grants.hostGrantStore });

    expect(await allowedSecrets(release())).toEqual(["gmail.imap"]);
    expect(prompt).not.toHaveBeenCalled();
  });

  it("writes an answer somewhere the next launch will see", async () => {
    const grants = await loadGrants({});
    const grant = vi.fn();
    grants.setGrantPersist({ grant, revoke: vi.fn() });
    setSecretConsent({
      prompt: async (request) => ({ allowed: request.aliases, remember: true }),
      grants: grants.hostGrantStore,
    });

    await allowedSecrets(release());
    grants.setGrantPersist(null);

    expect(grant).toHaveBeenCalledWith(grantKey(release()), ["gmail.imap"]);
  });

  it("writes nothing for an answer that was not to be remembered", async () => {
    const grants = await loadGrants({});
    const grant = vi.fn();
    grants.setGrantPersist({ grant, revoke: vi.fn() });
    setSecretConsent({
      prompt: async (request) => ({ allowed: request.aliases, remember: false }),
      grants: grants.hostGrantStore,
    });

    await allowedSecrets(release());
    grants.setGrantPersist(null);

    expect(grant).not.toHaveBeenCalled();
  });

  it("adds to a grant rather than replacing it", async () => {
    // A board that comes to need `slack` is asked about `slack` alone, so the
    // answer carries only that — and must not read as withdrawing `gmail.imap`.
    const key = grantKey(release());
    const grants = await loadGrants({ [key]: ["gmail.imap"] });
    setSecretConsent({
      prompt: async (request) => ({ allowed: request.aliases, remember: true }),
      grants: grants.hostGrantStore,
    });

    await allowedSecrets(release({ aliases: ["gmail.imap", "slack"] }));

    expect(grants.grantedAliases(key)).toEqual(["gmail.imap", "slack"]);
  });

  it("forgets one, so the next release asks again", async () => {
    const key = grantKey(release());
    const grants = await loadGrants({ [key]: ["gmail.imap"] });
    const prompt = vi.fn(async () => ({ allowed: [], remember: false }));
    setSecretConsent({ prompt, grants: grants.hostGrantStore });

    grants.forgetGrant(key);

    expect(await allowedSecrets(release())).toEqual([]);
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it("does not follow the same runtime id to another address", async () => {
    const grants = await loadGrants({ [grantKey(release())]: ["gmail.imap"] });
    const prompt = vi.fn(async () => ({ allowed: [], remember: false }));
    setSecretConsent({ prompt, grants: grants.hostGrantStore });

    expect(
      await allowedSecrets(release({ url: "https://evil.example" })),
    ).toEqual([]);
    expect(prompt).toHaveBeenCalledTimes(1);
  });
});

/**
 * The store a host that keeps nothing falls back to.
 *
 * This is what the website runs: no injection, so no host store, so grants live
 * in the browser alongside everything else the tab remembers. It is the weaker
 * position — site data is cleared more casually than a file in a home
 * directory, and anything running in the page can write one — but it is what a
 * browser has, and being asked again is the direction it fails in.
 */
describe("the browser-storage fallback", () => {
  const stored = (request: SecretRelease) =>
    window.localStorage.getItem(`hkp.secret-grants:${grantKey(request)}`);

  afterEach(() => window.localStorage.clear());

  it("is what a host that registered nothing gets", async () => {
    // Nothing is registered here on purpose: the default has to be the store,
    // not an absence that quietly forgets every answer.
    setSecretConsent({
      prompt: async (r) => ({ allowed: r.aliases, remember: true }),
    });

    await allowedSecrets(release());

    expect(JSON.parse(stored(release())!)).toEqual(["gmail.imap"]);
  });

  it("does not ask a second time for what it remembered", async () => {
    const prompt = vi.fn(async (r: SecretRelease) => ({
      allowed: r.aliases,
      remember: true,
    }));
    setSecretConsent({ prompt });

    await allowedSecrets(release());
    expect(await allowedSecrets(release())).toEqual(["gmail.imap"]);
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it("adds to a grant rather than replacing it", async () => {
    setSecretConsent({
      prompt: async (r) => ({ allowed: r.aliases, remember: true }),
    });

    await allowedSecrets(release());
    await allowedSecrets(release({ aliases: ["gmail.imap", "slack"] }));

    expect(JSON.parse(stored(release())!)).toEqual(["gmail.imap", "slack"]);
  });

  it("writes nothing for an answer that was not to be remembered", async () => {
    setSecretConsent({
      prompt: async (r) => ({ allowed: r.aliases, remember: false }),
    });

    await allowedSecrets(release());

    expect(stored(release())).toBeNull();
  });

  it("reads nothing out of a key holding something else", async () => {
    window.localStorage.setItem(
      `hkp.secret-grants:${grantKey(release())}`,
      '"not a list"',
    );
    const prompt = vi.fn(async () => ({ allowed: [], remember: false }));
    setSecretConsent({ prompt });

    expect(await allowedSecrets(release())).toEqual([]);
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it("asks again rather than throwing where there is no storage", async () => {
    // A private window, or storage switched off. Both reads and writes throw,
    // and neither may take the page down with them. Replaced outright rather
    // than spied on: the one jsdom provides is a proxy a spy does not stick to.
    const real = Object.getOwnPropertyDescriptor(window, "localStorage");
    const unavailable = () => {
      throw new Error("storage is disabled");
    };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { getItem: unavailable, setItem: unavailable },
    });

    try {
      const prompt = vi.fn(async (r: SecretRelease) => ({
        allowed: r.aliases,
        remember: true,
      }));
      setSecretConsent({ prompt });

      expect(await allowedSecrets(release())).toEqual(["gmail.imap"]);
      expect(await allowedSecrets(release())).toEqual(["gmail.imap"]);
      // Remembered nowhere, so asked both times — the safe direction.
      expect(prompt).toHaveBeenCalledTimes(2);
    } finally {
      if (real) {
        Object.defineProperty(window, "localStorage", real);
      }
    }
  });
});
