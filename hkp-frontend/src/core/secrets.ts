/**
 * Secret references in a board.
 *
 * A board says *which* secret a field needs, never what it is:
 *
 *     "password": "{{secret.gmail}}"
 *
 * The value lives outside the board — the native app's settings, an OS
 * keychain, whatever a host provides. This is what makes a board safe to share,
 * download, or hand to a model: there is nothing to redact, because the file
 * never held the secret.
 *
 * A reference is also what a *service* holds. It is never substituted into
 * service state, so `getState` reports the reference unchanged and saving a
 * board writes back what was configured. The value exists only inside the call
 * that uses it, obtained through `withSecrets`.
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
const REFERENCE = /\{\{\s*secret\.([A-Za-z0-9_.-]+)\s*\}\}/g;

export type SecretStore = {
  /** The value behind an alias, or null when the store does not have it. */
  get(alias: string): string | null;
  /**
   * The hosts this secret may be sent to. Absent, or an empty list, means the
   * secret is unconstrained — which is what an entry that predates audiences
   * answers, and is why adding one is not a breaking change.
   */
  audience?(alias: string): string[] | null;
  /** Every alias the store holds. */
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

/** Aliases a value refers to that the store cannot supply. */
export function unavailableSecrets(
  value: unknown,
  from: SecretStore = store,
): string[] {
  return referencedSecrets(value).filter((alias) => from.get(alias) === null);
}

/** Where a secret is about to be sent. */
export type SecretUse = {
  /**
   * The destination, as a URL or a `host[:port]`. Only the host is compared
   * against an audience; the rest is accepted so that a caller can pass
   * whatever it already has.
   */
  to: string;
};

export type SecretRefusal = {
  alias: string;
  /** The host that was asked for. */
  to: string;
  /** The hosts the store allows instead. */
  audience: string[];
};

export type ResolvedSecrets<T> = {
  /** The input with every reference replaced. */
  value: T;
  /** Aliases the store does not hold. */
  missing: string[];
  /** Aliases the store holds but may not send to this destination. */
  refused: SecretRefusal[];
};

/**
 * A value with its secret references resolved, for one use, at the moment of
 * that use.
 *
 * The result is transient: it is what a service passes to the call it is
 * making, and it must not be assigned back to the service's state or returned
 * from `getState`. Keeping references in state and resolving here is what makes
 * a board safe to save — there is never a resolved value in the state a board
 * is serialized from.
 *
 * `to` is required, and a caller that cannot say where the value is going gets
 * nothing. Every caller can: a secret is used by sending it somewhere, and the
 * code sending it knows the address. Requiring it is what lets the store
 * constrain a secret to a destination, and what stops a configuration from
 * pointing an otherwise honest caller at somewhere else.
 *
 * An alias that is missing, or that may not go to this destination, resolves to
 * an empty string rather than being left as the literal `{{secret.…}}`: a
 * caller handed that text would send it as a credential and fail somewhere far
 * away with an authentication error that names nothing. Empty is what "not
 * configured" already looks like. Both cases are reported by name.
 */
export function withSecrets<T>(
  value: T,
  use: SecretUse,
  from: SecretStore = store,
): ResolvedSecrets<T> {
  const host = destinationHost(use?.to);
  if (!host) {
    throw new Error(
      "withSecrets requires a destination: pass { to } naming the host the secret is sent to",
    );
  }

  const missing = new Set<string>();
  const refused = new Map<string, SecretRefusal>();

  const resolved = walk(value, (text) =>
    text.replace(REFERENCE, (_whole, alias: string) => {
      const secret = from.get(alias);
      if (secret === null) {
        missing.add(alias);
        return "";
      }
      const audience = from.audience?.(alias) ?? null;
      if (!permits(audience, host)) {
        refused.set(alias, { alias, to: host, audience: audience ?? [] });
        return "";
      }
      return secret;
    }),
  );

  return {
    value: resolved as T,
    missing: [...missing],
    refused: [...refused.values()],
  };
}

/**
 * The host part of a destination.
 *
 * Callers hold destinations in whatever shape their own API uses — a request
 * URL, a `host:port` pair, a bare hostname — and normalizing here is what keeps
 * an audience a list of hosts rather than a list of spellings. Anything that
 * does not yield a host answers `null`, which `withSecrets` treats as no
 * destination at all.
 */
export function destinationHost(to: unknown): string | null {
  if (typeof to !== "string") {
    return null;
  }
  const trimmed = to.trim();
  if (!trimmed) {
    return null;
  }
  const candidate = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `hkp://${trimmed}`;
  try {
    const { hostname } = new URL(candidate);
    return hostname ? hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Whether an audience covers a host.
 *
 * An entry is either a host or a `*.` prefix standing for any subdomain of what
 * follows it. The wildcard does not match the bare domain: `*.example.com`
 * covers `api.example.com` and not `example.com`, so widening one to the other
 * stays a deliberate act.
 */
function permits(audience: string[] | null, host: string): boolean {
  if (!audience || !audience.length) {
    return true;
  }
  return audience.some((entry) => {
    const allowed = entry.trim().toLowerCase();
    if (!allowed) {
      return false;
    }
    if (allowed.startsWith("*.")) {
      return host.endsWith(allowed.slice(1));
    }
    return host === allowed;
  });
}

/**
 * Applies `visit` to every string in a structure, rebuilding it as it goes.
 *
 * Only plain objects and arrays are entered. A board's state can carry things
 * that are not JSON — a Uint8Array, a class instance a service put there — and
 * rebuilding one of those field by field would quietly change what it is.
 */
function walk(value: unknown, visit: (text: string) => string): unknown {
  if (typeof value === "string") {
    return visit(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => walk(item, visit));
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    out[key] = walk(entry, visit);
  }
  return out;
}
