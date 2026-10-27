import { useCallback, useEffect, useState } from "react";

import { readGrantKey } from "hkp-frontend/src/core/secretConsent";
import { allGrants } from "hkp-frontend/src/grants";

/**
 * The host calls a secrets view needs: the native apps' backend satisfies it
 * (`meander/frontend/src/backend`). Every call is optional because a host
 * without a store has none of them, and an older build only some.
 */
export type SecretsHost = {
  listSecrets?(): Promise<string[]>;
  setSecret?(alias: string, value: string): Promise<void>;
  deleteSecret?(alias: string): Promise<void>;
  listSecretAudiences?(): Promise<Record<string, string[]>>;
  setSecretAudience?(alias: string, audience: string[]): Promise<void>;
  revokeSecretGrant?(key: string): Promise<void>;
};

/** What a secret says about itself: its name and where it may be sent. */
export type SecretEntry = { alias: string; audience: string[] };

/** One remembered answer to the consent prompt. */
export type SecretGrant = {
  key: string;
  boardName: string;
  runtimeId: string;
  origin: string;
  aliases: string[];
};

function heldGrants(): SecretGrant[] {
  return Object.entries(allGrants())
    .map(([key, aliases]) => {
      const parts = readGrantKey(key);
      return parts ? { key, ...parts, aliases } : null;
    })
    .filter((grant): grant is SecretGrant => grant !== null)
    .sort((a, b) => a.boardName.localeCompare(b.boardName));
}

/** An audience as typed: a comma or space separated list of hosts. */
export function parseAudience(text: string): string[] {
  return text
    .split(/[,\s]+/)
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Why a secret cannot be saved as typed, or null when it can. An undefined
 * value is one left as it is; an empty one is not a value.
 */
export function secretProblem(alias: string, value: string | undefined): string | null {
  // The alias is what a board writes into a reference, so it is limited to
  // what a reference can express rather than to what a name could be.
  if (!/^[A-Za-z0-9_.-]+$/.test(alias)) {
    return "Use letters, digits, dots, hyphens and underscores only.";
  }
  if (value !== undefined && !value) {
    return "A secret with no value is the same as not having one.";
  }
  return null;
}

/** A change to one secret. What is left undefined is left as it is. */
export type SecretChange = {
  alias: string;
  value?: string;
  audience?: string[];
};

/**
 * The secrets a host holds and the grants it remembers, with what can be done
 * to them. Shared by the desktop's settings tab and the phones' Secrets page,
 * which differ in layout only.
 *
 * Values are write-only here: they can be set and replaced, never read back.
 * The audience is not a secret and is listed, because it is the part worth
 * checking.
 */
export function useSecrets(host: () => Promise<SecretsHost>) {
  const [entries, setEntries] = useState<SecretEntry[] | null>(null);
  const [supported, setSupported] = useState(true);
  const [constrainable, setConstrainable] = useState(true);
  const [grants, setGrants] = useState<SecretGrant[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const backend = await host();
    if (!backend.listSecrets) {
      setSupported(false);
      setEntries([]);
      return;
    }
    const aliases = (await backend.listSecrets()).sort();
    // An older app build holds values only. Say so rather than offering an
    // edit that would fail: without a way to write one, every secret is
    // unconstrained and nothing in this view can change that.
    setConstrainable(!!backend.setSecretAudience);
    const audiences = (await backend.listSecretAudiences?.()) ?? {};
    setEntries(aliases.map((name) => ({ alias: name, audience: audiences[name] ?? [] })));
    setGrants(backend.revokeSecretGrant ? heldGrants() : []);
  }, [host]);

  useEffect(() => {
    void refresh().catch(() => setSupported(false));
  }, [refresh]);

  /** Runs one change against the host; false, with `error` set, if it failed. */
  const attempt = async (change: (backend: SecretsHost) => Promise<unknown>) => {
    setError("");
    try {
      await change(await host());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await refresh().catch(() => {});
      return false;
    }
    await refresh();
    return true;
  };

  const save = async ({ alias, value, audience }: SecretChange): Promise<boolean> => {
    const problem = secretProblem(alias, value);
    if (problem) {
      setError(problem);
      return false;
    }
    return attempt(async (backend) => {
      if (value !== undefined) {
        await backend.setSecret!(alias, value);
      }
      if (audience !== undefined) {
        await backend.setSecretAudience?.(alias, audience);
      }
    });
  };

  const remove = (alias: string) => attempt((backend) => backend.deleteSecret!(alias));

  const revoke = (key: string) => attempt((backend) => backend.revokeSecretGrant!(key));

  return {
    entries,
    supported,
    constrainable,
    grants,
    error,
    setError,
    save,
    remove,
    revoke,
  };
}
