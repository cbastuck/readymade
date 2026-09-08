import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setSecretStore, withSecrets } from "hkp-frontend/src/core/secrets";

/**
 * Where a secret may be sent, and how it comes to have an answer.
 *
 * An audience is what separates "this board holds a credential" from "this
 * board can take a credential anywhere": without one, a service pointed at
 * somewhere else by a board resolves the same value just as happily. Most are
 * never configured by hand, so the first destination a secret is released to is
 * recorded as the answer.
 */

/** A fresh copy of the vault module, reading whatever the host injected. */
async function loadVault(injected: unknown) {
  vi.resetModules();
  (window as any).__HKP_VAULT__ = injected;
  return import("hkp-frontend/src/vault");
}

afterEach(() => {
  delete (window as any).__HKP_VAULT__;
  setSecretStore(null);
});

describe("reading what the host injected", () => {
  it("takes a bare string as a value nothing constrains", async () => {
    const vault = await loadVault({ gmail: "hunter2" });

    expect(vault.vaultGet("gmail")).toBe("hunter2");
    expect(vault.vaultAudience("gmail")).toEqual([]);
  });

  it("takes the long form as a value and its audience", async () => {
    const vault = await loadVault({
      gmail: { value: "hunter2", audience: ["imap.gmail.com"] },
    });

    expect(vault.vaultGet("gmail")).toBe("hunter2");
    expect(vault.vaultAudience("gmail")).toEqual(["imap.gmail.com"]);
  });

  it("drops an entry with no value rather than holding a nameable nothing", async () => {
    const vault = await loadVault({ gmail: { audience: ["imap.gmail.com"] } });

    expect(vault.vaultAliases()).toEqual([]);
  });

  it("keeps the audience when the value is replaced", async () => {
    const vault = await loadVault({
      gmail: { value: "hunter2", audience: ["imap.gmail.com"] },
    });
    vault.vaultSet("gmail", "hunter3");

    expect(vault.vaultAudience("gmail")).toEqual(["imap.gmail.com"]);
  });

  it("says nothing about an audience it has no entry for", async () => {
    const vault = await loadVault({});
    vault.vaultSetAudience("absent", ["imap.gmail.com"]);

    expect(vault.vaultAudience("absent")).toEqual([]);
  });
});

describe("the audience the store reports", () => {
  it("reports an empty audience as unconstrained rather than as a list", async () => {
    const vault = await loadVault({ gmail: "hunter2" });

    // Empty and absent have to answer the same thing: a store that returned []
    // would read as "may go nowhere" to a checker that treats a list as the
    // whole of what is permitted.
    expect(vault.vaultSecretStore.audience("gmail")).toBeNull();
  });

  it("reports a configured audience", async () => {
    const vault = await loadVault({
      gmail: { value: "hunter2", audience: ["imap.gmail.com"] },
    });

    expect(vault.vaultSecretStore.audience("gmail")).toEqual([
      "imap.gmail.com",
    ]);
  });
});

describe("recording the first destination", () => {
  let vault: Awaited<ReturnType<typeof loadVault>>;

  beforeEach(async () => {
    vault = await loadVault({ gmail: "hunter2" });
    setSecretStore(vault.vaultSecretStore);
  });

  it("pins an unconstrained secret to where it was first sent", () => {
    withSecrets("{{secret.gmail}}", { to: "imaps://imap.gmail.com:993" });

    expect(vault.vaultAudience("gmail")).toEqual(["imap.gmail.com"]);
  });

  it("refuses that secret anywhere else afterwards", () => {
    withSecrets("{{secret.gmail}}", { to: "https://imap.gmail.com" });
    const later = withSecrets("{{secret.gmail}}", {
      to: "https://evil.example",
    });

    expect(later.value).toBe("");
    expect(later.refused).toEqual([
      { alias: "gmail", to: "evil.example", audience: ["imap.gmail.com"] },
    ]);
  });

  it("does not widen an audience that was already decided", () => {
    vault.vaultSetAudience("gmail", ["imap.gmail.com"]);
    withSecrets("{{secret.gmail}}", { to: "https://evil.example" });

    expect(vault.vaultAudience("gmail")).toEqual(["imap.gmail.com"]);
  });

  it("records nothing for a secret it does not hold", () => {
    withSecrets("{{secret.absent}}", { to: "https://evil.example" });

    expect(vault.vaultAliases()).toEqual(["gmail"]);
  });

  it("writes what it learned somewhere the next launch will see", () => {
    const setAudience = vi.fn();
    vault.setVaultPersist({ setAudience });
    withSecrets("{{secret.gmail}}", { to: "https://imap.gmail.com" });
    vault.setVaultPersist(null);

    expect(setAudience).toHaveBeenCalledWith("gmail", ["imap.gmail.com"]);
  });
});
