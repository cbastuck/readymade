import { validateToken } from "hkp-frontend/src/core/Auth";

/**
 * Persistence for the native login's tokens.
 *
 * The native flow (system browser + PKCE) hands back the tokens and nothing else
 * holds on to them: unlike the web flow there is no auth0-spa-js client with its
 * own cache, so without this a page reload silently signs the user out — and
 * every request to an authenticated runtime then fails with a 401 that looks
 * like a permissions problem rather than a lost session.
 *
 * An id_token expires in hours, so it alone cannot keep anyone signed in for
 * long. The refresh token is what does, which is why both live here.
 *
 * Stored in webview localStorage, the same place (and the same exposure) as the
 * web build's `cacheLocation: "localstorage"` Auth0 cache. A refresh token is
 * the more valuable of the two and raises the stakes of that choice: moving this
 * to the host's keychain was already worth doing and is more so now. It needs a
 * native store on each platform, so it is deliberately not on this path yet.
 */
const STORAGE_KEY = "readymade-id-token";

type StoredSession = { idToken: string; refreshToken?: string };

/** What is in storage, in whichever shape it was written. */
function read(): StoredSession | null {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!stored) {
    return null;
  }
  // Sessions written before refresh tokens were kept are a bare JWT. Reading
  // those as one keeps everyone who is signed in today signed in.
  if (!stored.startsWith("{")) {
    return { idToken: stored };
  }
  try {
    const parsed = JSON.parse(stored) as Partial<StoredSession>;
    return typeof parsed?.idToken === "string"
      ? { idToken: parsed.idToken, refreshToken: parsed.refreshToken }
      : null;
  } catch {
    return null;
  }
}

export function saveSession(idToken: string, refreshToken?: string): void {
  try {
    // A renewal that returns no new refresh token leaves the old one in place;
    // dropping it would end the session at the next expiry for no reason.
    const kept = refreshToken ?? read()?.refreshToken;
    const session: StoredSession = kept
      ? { idToken, refreshToken: kept }
      : { idToken };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    // A full or unavailable store must not break a successful login; the user
    // stays signed in for this page, just not across a reload.
    console.warn("[session] Could not persist the session:", err);
  }
}

/** The stored refresh token, if the login returned one. */
export function loadRefreshToken(): string | null {
  return read()?.refreshToken ?? null;
}

/**
 * Whether a session is stored at all, valid or not.
 *
 * Distinguishes "the store is empty" from "what is in it cannot be used", which
 * otherwise look identical from the outside and have opposite causes.
 */
export function hasStoredSession(): boolean {
  return read() !== null;
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — the token is gone from memory either way.
  }
}

/**
 * The stored id_token while it is valid, or null.
 *
 * An expired one is not returned — handing it back would only produce a 401
 * later, at a point far from the cause — but it is also not erased: the refresh
 * token beside it may still renew the session, and clearing here would throw
 * away the one thing that can recover it.
 */
export function loadSession(): string | null {
  const stored = read()?.idToken ?? null;
  if (!stored) {
    return null;
  }

  try {
    // Throws "token expired" past exp, and yields {} for a token with no exp.
    const validated = validateToken(stored);
    if (!validated || !validated.token) {
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}
