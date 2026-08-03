import { AUTH0_DOMAIN, AUTH0_CLIENT_ID } from "./meanderLogin";
import {
  clearSession,
  loadRefreshToken,
  loadSession,
  saveSession,
} from "./session";

/**
 * Renewing the native session.
 *
 * An id_token lasts hours; the session behind it lasts days. Without a way to
 * renew, the app looks signed out long before anyone actually signed out —
 * which is exactly what pressing "log in" then reveals, going straight through
 * without asking for credentials because the session at Auth0 was there all
 * along.
 *
 * The web build gets this from auth0-spa-js. The native flow has no such client,
 * so the refresh grant is made here directly. Nothing in this file can prompt
 * anyone: if the exchange fails, the session is over and the next sign-in is a
 * deliberate one.
 */

type TokenResponse = {
  id_token?: string;
  refresh_token?: string;
};

/**
 * At most one exchange at a time, shared by everyone who asks while it runs.
 *
 * Rotation makes this a correctness requirement, not an optimisation: each
 * exchange invalidates the token it spent, and Auth0 treats a second use of a
 * spent token as theft and revokes the whole family. Two callers racing — the
 * startup restore and the pre-expiry timer, say — would do exactly that and sign
 * the user out for good.
 */
let inFlight: Promise<string | null> | null = null;

async function exchange(refreshToken: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: AUTH0_CLIENT_ID,
        refresh_token: refreshToken,
      }).toString(),
    });
  } catch (err) {
    // Offline, most likely. The token is probably still good, so it is kept and
    // the next attempt can use it.
    console.warn("[session] Could not reach Auth0 to renew the session:", err);
    return null;
  }
  if (!res.ok) {
    // Revoked, expired, or rotated out from under us. Nothing here can recover
    // it, and keeping it would mean retrying a dead token on every start.
    console.warn(`[session] Could not renew the session (${res.status})`);
    clearSession();
    return null;
  }
  const token = (await res.json()) as TokenResponse;
  if (!token.id_token) {
    return null;
  }
  // Rotation issues a replacement and invalidates the token just spent, so
  // whatever came back has to be stored — or the next renewal is already dead.
  // When none comes back, the existing one stays (see saveSession).
  saveSession(token.id_token, token.refresh_token);
  return token.id_token;
}

/**
 * Trades the stored refresh token for a fresh id_token, or null when there is
 * none or it no longer works.
 */
export function refreshNativeSession(): Promise<string | null> {
  if (inFlight) {
    return inFlight;
  }
  const refreshToken = loadRefreshToken();
  if (!refreshToken) {
    // Either nobody is signed in, or they signed in through a flow that returns
    // no refresh token (the iOS/Android bridge exchanges tokens natively and
    // hands back only an id_token). Both mean signing in again.
    return Promise.resolve(null);
  }
  inFlight = exchange(refreshToken).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * The id_token to start with: the stored one while it is valid, a renewed one
 * when it is not, or null when nobody is signed in.
 */
export async function restoreNativeSession(): Promise<string | null> {
  return loadSession() ?? (await refreshNativeSession());
}
