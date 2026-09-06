
declare global {
  interface Window {
    __HKP_VAULT__?: Record<string, string>;
  }
}

const cache: Record<string, string> = { ...(window.__HKP_VAULT__ ?? {}) };

export function vaultGet(key: string): string | null {
  return cache[key] ?? null;
}

export function vaultSet(key: string, value: string) {
  cache[key] = value;
}

export function vaultDelete(key: string): void {
  delete cache[key];
}

/** Every name held. The values are not enumerable through this. */
export function vaultAliases(): string[] {
  return Object.keys(cache);
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
  list: vaultAliases,
};
