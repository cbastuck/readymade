import { validateToken } from "hkp-frontend/src/core/Auth";

/**
 * Persistence for the native login's id_token.
 *
 * The native flow (system browser + PKCE) hands back a raw id_token and nothing
 * else holds on to it: unlike the web flow there is no auth0-spa-js client with
 * its own cache, so without this a page reload silently signs the user out —
 * and every request to an authenticated runtime then fails with a 401 that looks
 * like a permissions problem rather than a lost session.
 *
 * Stored in webview localStorage, which is the same place (and the same exposure)
 * as the web build's `cacheLocation: "localstorage"` Auth0 cache. Moving this to
 * the host's keychain would be stronger and is worth doing; it needs a native
 * store on each platform, so it is deliberately not on this path yet.
 */
const STORAGE_KEY = "readymade-id-token";

export function saveSession(idToken: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, idToken);
  } catch (err) {
    // A full or unavailable store must not break a successful login; the user
    // stays signed in for this page, just not across a reload.
    console.warn("[session] Could not persist the session:", err);
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — the token is gone from memory either way.
  }
}

/**
 * The stored id_token, or null when there is none or it has expired. An expired
 * token is dropped rather than returned: handing it back would only produce a
 * 401 later, at a point far from the cause.
 */
export function loadSession(): string | null {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!stored) {
    return null;
  }

  try {
    // Throws "token expired" past exp, and yields {} for a token with no exp.
    const validated = validateToken(stored);
    if (!validated || !validated.token) {
      clearSession();
      return null;
    }
    return stored;
  } catch {
    clearSession();
    return null;
  }
}
