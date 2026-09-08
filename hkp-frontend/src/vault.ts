/**
 * The host's secret values, as the page sees them.
 *
 * An entry is a value and the hosts it may be sent to. The audience is what
 * turns an alias into a constrained credential: `withSecrets` refuses to
 * release one to anywhere else, and the same list travels with the value when
 * it is pushed to a remote runtime, so the constraint holds wherever the secret
 * is actually used. An empty audience is unconstrained, which is what every
 * entry answers until something records a destination for it.
 */

export type VaultEntry = {
  value: string;
  /** Hosts this secret may be sent to. Empty means unconstrained. */
  audience: string[];
};

declare global {
  interface Window {
    /**
     * Injected by the host at page creation. Entries are `{ value, audience }`;
     * a bare string is read as a value with no audience, which is what a host
     * that predates audiences injects.
     */
    __HKP_VAULT__?: Record<string, string | Partial<VaultEntry>>;
  }
}

function normalize(entry: string | Partial<VaultEntry> | undefined): VaultEntry | null {
  if (typeof entry === "string") {
    return { value: entry, audience: [] };
  }
  if (!entry || typeof entry.value !== "string") {
    return null;
  }
  return {
    value: entry.value,
    audience: Array.isArray(entry.audience)
      ? entry.audience.filter((host): host is string => typeof host === "string" && !!host)
      : [],
  };
}

const cache: Record<string, VaultEntry> = {};
for (const [alias, entry] of Object.entries(window.__HKP_VAULT__ ?? {})) {
  const normalized = normalize(entry);
  if (normalized) {
    cache[alias] = normalized;
  }
}

export function vaultGet(key: string): string | null {
  return cache[key]?.value ?? null;
}

/** Where this secret may be sent. Empty, or unknown, means unconstrained. */
export function vaultAudience(key: string): string[] {
  return cache[key]?.audience ?? [];
}

/** Sets the value, leaving the audience the entry already had. */
export function vaultSet(key: string, value: string) {
  cache[key] = { value, audience: cache[key]?.audience ?? [] };
}

/** Sets where an entry may be sent, leaving its value alone. */
export function vaultSetAudience(key: string, audience: string[]): void {
  if (cache[key]) {
    cache[key] = { value: cache[key].value, audience: [...audience] };
  }
}

export function vaultDelete(key: string): void {
  delete cache[key];
}

/** Every name held. The values are not enumerable through this. */
export function vaultAliases(): string[] {
  return Object.keys(cache);
}

/**
 * Where a change to the cache is written so it survives the page.
 *
 * The cache is a copy: the host injects it at page creation and reads it back
 * never. Anything learned while a board runs — an audience recorded on first
 * use — would be forgotten on the next launch without somewhere durable to put
 * it, and only the host knows where that is. Unset on a host with no store,
 * where the copy is all there ever was.
 */
export type VaultPersist = {
  setAudience(alias: string, audience: string[]): void;
};

let persist: VaultPersist | null = null;

export function setVaultPersist(next: VaultPersist | null): void {
  persist = next;
}

/**
 * The vault as a secret store, for `{{secret.…}}` references in a board.
 *
 * The host fills the cache — the desktop app injects `window.__HKP_VAULT__` at
 * page creation, so it is populated before any board loads. Registering this
 * is what turns a reference in a board into a value; without it the same board
 * opens with those fields unset and says so.
 */
export const vaultSecretStore = {
  get: vaultGet,
  audience: (alias: string): string[] | null => {
    const held = vaultAudience(alias);
    return held.length ? held : null;
  },
  list: vaultAliases,
  /**
   * Records the first destination a secret is released to.
   *
   * Trust on first use: an unconstrained secret is pinned to wherever it was
   * legitimately sent, and every later use of it against somewhere else is
   * refused until a person widens the audience. It costs nothing in the normal
   * case — a board that has always talked to one host keeps working — and it
   * is what stops a board acquired later from taking a credential somewhere it
   * has never been.
   *
   * The known limit is in the name: the *first* use is trusted, so this
   * protects a secret that has been used before, not one being used for the
   * first time by the board that means to steal it.
   */
  learn: (alias: string, host: string): void => {
    if (!cache[alias] || cache[alias].audience.length || !host) {
      return;
    }
    vaultSetAudience(alias, [host]);
    persist?.setAudience(alias, [host]);
  },
};
