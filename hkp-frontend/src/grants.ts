/**
 * The host's record of which board may hand which secrets to which runtime.
 *
 * A grant is the remembered answer to the consent prompt — see
 * `core/secretConsent.ts` for what it is keyed on and why. This is the copy the
 * page reads: the host injects it before any board loads, because provisioning
 * starts as soon as one does and a grant that arrived a moment later would be a
 * question asked again for something already answered.
 *
 * Nothing here is a secret. What it protects is the release of values that live
 * elsewhere, which is why it is still somewhere only its owner can write.
 */

import { GrantStore } from "hkp-frontend/src/core/secretConsent";

declare global {
  interface Window {
    /** Injected by the host at page creation: grant key to aliases. */
    __HKP_GRANTS__?: Record<string, unknown>;
  }
}

function names(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((alias): alias is string => typeof alias === "string" && !!alias)
    : [];
}

/**
 * Whether the host keeps grants at all.
 *
 * An injection that is present but empty is a host with a store and nothing in
 * it yet; an absent one is a host with nowhere to put them, which is a
 * different thing and should keep whatever fallback it had.
 */
const injected = window.__HKP_GRANTS__ !== undefined;

export function hostKeepsGrants(): boolean {
  return injected;
}

const cache: Record<string, string[]> = {};
for (const [key, aliases] of Object.entries(window.__HKP_GRANTS__ ?? {})) {
  const granted = names(aliases);
  if (granted.length) {
    cache[key] = granted;
  }
}

export function grantedAliases(key: string): string[] {
  return cache[key] ?? [];
}

/** Every grant held, for showing and revoking them. */
export function allGrants(): Record<string, string[]> {
  return { ...cache };
}

export function forgetGrant(key: string): void {
  delete cache[key];
}

/**
 * Where a change to the cache is written so it survives the page.
 *
 * The cache is a copy: the host injects it and reads it back never. Only the
 * host knows where a durable one lives, so a page with no host keeps its
 * answers for the session and asks again next time — the safe direction.
 */
export type GrantPersist = {
  grant(key: string, aliases: string[]): void;
  revoke(key: string): void;
};

let persist: GrantPersist | null = null;

export function setGrantPersist(next: GrantPersist | null): void {
  persist = next;
}

/**
 * The injected grants as a store, for `core/secretConsent.ts`.
 *
 * Registering this is what makes an answer outlive the page. Without it the
 * consent gate falls back to `localStorage`, which is what the website has.
 */
export const hostGrantStore: GrantStore = {
  granted: grantedAliases,
  /**
   * Merged rather than replaced, matching what the host writes: a board that
   * comes to need one more secret is asked about that one alone, and the answer
   * must not be read as withdrawing what was already agreed.
   */
  grant: (key: string, aliases: string[]): void => {
    const merged = [...new Set([...grantedAliases(key), ...aliases])].sort();
    if (!merged.length) {
      return;
    }
    cache[key] = merged;
    persist?.grant(key, aliases);
  },
};
