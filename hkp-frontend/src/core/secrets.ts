/**
 * Secret references in a board.
 *
 * A board says *which* secret a field needs, never what it is:
 *
 *     "password": "{{secret.gmail}}"
 *
 * The value lives outside the board — the native app's settings, an OS
 * keychain, whatever a host provides — and is substituted in on load. This is
 * what makes a board safe to share, download, or hand to a model: there is
 * nothing to redact, because the file never held the secret.
 *
 * The store is deliberately an interface with no implementation here. Web and
 * native protect secrets very differently, and the part that must be identical
 * across them is the *format* — so that a board written on one opens on the
 * other. Nothing is registered until a host registers something.
 */

/**
 * `{{secret.alias}}`, tolerating whitespace inside the braces.
 *
 * Dots are part of an alias rather than separators: `secret.` is a fixed
 * prefix and `}}` terminates, so `{{secret.gmail.imap}}` has exactly one
 * reading. Allowing them matters because the app's older per-service vault
 * path writes `<serviceUuid>.<field>` keys, and those have to be nameable by
 * the same syntax as everything else in the store.
 */
import { mapStrings } from "../runtime/board/traversal";

const REFERENCE = /\{\{\s*secret\.([A-Za-z0-9_.-]+)\s*\}\}/g;

export type SecretStore = {
  /** The value behind an alias, or null when the store does not have it. */
  get(alias: string): string | null;
  /** Every alias the store holds. Used to put values back on the way out. */
  list(): string[];
};

const EMPTY_STORE: SecretStore = { get: () => null, list: () => [] };

let store: SecretStore = EMPTY_STORE;

/** Registered once by the host — the native app, the web app, or a test. */
export function setSecretStore(next: SecretStore | null): void {
  store = next ?? EMPTY_STORE;
}

export function secretStore(): SecretStore {
  return store;
}

/** How a board writes a reference to `alias`. */
export function secretReference(alias: string): string {
  return `{{secret.${alias}}}`;
}

/** Every alias a value refers to, however deeply it is nested. */
export function referencedSecrets(value: unknown): string[] {
  const found = new Set<string>();
  walk(value, (text) => {
    for (const match of text.matchAll(REFERENCE)) {
      found.add(match[1]);
    }
    return text;
  });
  return [...found];
}

/**
 * Substitutes stored values for references, anywhere in a structure.
 *
 * An alias the store does not have becomes an empty string rather than being
 * left as the literal `{{secret.…}}`: a service handed that text would send it
 * as a password and fail somewhere far away with an authentication error that
 * names nothing. Empty is what "not configured" already looks like to every
 * service that takes a credential, and the missing aliases are returned so the
 * board can say which ones by name.
 */
export function resolveSecrets<T>(
  value: T,
  from: SecretStore = store,
): { value: T; missing: string[] } {
  const missing = new Set<string>();
  const resolved = walk(value, (text) =>
    text.replace(REFERENCE, (_whole, alias: string) => {
      const secret = from.get(alias);
      if (secret === null) {
        missing.add(alias);
        return "";
      }
      return secret;
    }),
  );
  return { value: resolved as T, missing: [...missing] };
}

/**
 * Puts references back where values ended up — the inverse pass, for saving.
 *
 * Needed because a service is under no obligation to hide what it was given.
 * The ones that take a password mask it (`getState` answers `""`), and for
 * those this finds nothing to do. But a credential can also arrive as one
 * entry in a free-form map — an `Authorization` header on `http-client` — and
 * such a service reports its state in full, exactly as configured. Without
 * this pass, resolving a reference on load would write the resolved secret
 * into the board on the next save: the very leak the reference exists to
 * avoid, introduced by the mechanism meant to prevent it.
 *
 * Matching is on the value rather than on which field it came from, so it
 * holds wherever a secret ended up — nested in a map, joined into a larger
 * string like `Bearer <token>`, or in a field nobody thought to declare.
 *
 * That is also what is wrong with it, and this is a stopgap: a short or
 * ordinary secret would rewrite unrelated text, and the failure is silent.
 * It has exactly one caller in practice — `http-client`, which reports its
 * headers verbatim — and disappears once that service stops handing
 * credentials back, or once references are resolved runtime-side rather than
 * here. Recorded as G12b in TODO-WORKFLOW-PLATFORM.md.
 */
export function redactSecrets<T>(value: T, from: SecretStore = store): T {
  const entries = from
    .list()
    .map((alias) => ({ alias, secret: from.get(alias) ?? "" }))
    .filter((entry) => entry.secret.length > 0)
    // Longest first: one secret containing another must be matched as itself
    // before the shorter one rewrites part of it.
    .sort((a, b) => b.secret.length - a.secret.length);

  if (!entries.length) {
    return value;
  }
  return walk(value, (text) => {
    let out = text;
    for (const { alias, secret } of entries) {
      if (out.includes(secret)) {
        out = out.split(secret).join(secretReference(alias));
      }
    }
    return out;
  }) as T;
}

/**
 * Applies `visit` to every string in a structure, rebuilding it as it goes.
 * Shared with the unit-parameter pass — see `runtime/board/traversal`.
 */
function walk(value: unknown, visit: (text: string) => string): unknown {
  return mapStrings(value, visit);
}
