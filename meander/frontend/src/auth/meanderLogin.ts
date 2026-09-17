import {
  canReceiveServiceRedirect,
  openInBrowser,
  serviceRedirectUri,
} from "hkp-frontend/src/runtime/browser/services/helpers";
import {
  registerRedirect,
  unregisterRedirect,
} from "hkp-frontend/src/MessageDispatcher";

import { randomUrlSafe, s256Challenge } from "./pkce";
import { clearSignedOut, wasSignedOut } from "./session";

// The native Readymade app can't use Auth0's in-page web redirect, so it runs the
// RFC 8252 native flow: open the Auth0 login in the OS browser (via the existing
// openInBrowser bridge), capture the redirect through the /serviceRedirect relay
// — the app's own loopback HTTP server, which postMessages the parameters into
// the webview for MessageDispatcher — then exchange the code for tokens here.
// PKCE means this is a public client with no secret, so the token exchange is
// safe to run in the webview via fetch (the same way auth0-spa-js does).
export const AUTH0_DOMAIN = "hookitapp.eu.auth0.com";
// Configured as a Native application in Auth0. The id_token's `aud` is this
// client id, which is what hkp-node verifies against (AUTH0_AUDIENCE).
export const AUTH0_CLIENT_ID = "gpk8IFPKfaOTQUzpDRO7vBajOnB72rkM";

/** Resolve when the OAuth redirect for `state` is relayed back, or reject on timeout. */
function waitForRedirect(
  state: string,
  timeoutMs = 180_000,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unregisterRedirect(state);
      reject(new Error("Login timed out"));
    }, timeoutMs);
    registerRedirect(state, (data) => {
      clearTimeout(timer);
      unregisterRedirect(state);
      resolve(data);
    });
  });
}

export type NativeLogin = {
  idToken: string;
  /** Absent unless the Auth0 application grants offline access. */
  refreshToken?: string;
};

/**
 * Drives the Auth0 Authorization Code + PKCE flow and returns the tokens, or
 * null if the user cancelled (no code returned).
 */
export async function meanderLogin(): Promise<NativeLogin | null> {
  if (!canReceiveServiceRedirect()) {
    throw new Error(
      "Another Readymade instance is running and holds this app's login " +
        "callback port. Quit it and try again.",
    );
  }

  const verifier = randomUrlSafe(32);
  const challenge = await s256Challenge(verifier);
  const state = randomUrlSafe(16);
  // Answered by the app's own loopback server, which relays it back. Must be
  // listed in the Auth0 application's Allowed Callback URLs.
  const redirect = serviceRedirectUri();

  console.log(
    `[Readymade-login] Using redirect_uri ${redirect} — ensure it is an Allowed Callback URL in Auth0.`,
  );

  const params: Record<string, string> = {
    response_type: "code",
    client_id: AUTH0_CLIENT_ID,
    redirect_uri: redirect,
    // offline_access asks for a refresh token, without which the session ends
    // when the id_token does — hours, against the days the session at Auth0
    // lasts. Asking is not getting: whether one is issued depends on how the
    // Auth0 application is configured, which the token exchange reports below.
    scope: "openid profile email offline_access",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  };
  if (wasSignedOut()) {
    // Signing out could not end the session in the browser, so Auth0 would hand
    // this login the same account with nothing asked. This makes it ask — the
    // form still comes up filled in by the browser, which is the point of
    // running the login there; what it restores is the ability to answer with a
    // different account.
    params.prompt = "login";
  }

  const authorizeUrl =
    `https://${AUTH0_DOMAIN}/authorize?` + new URLSearchParams(params).toString();

  // Register the listener before opening the browser to avoid a race where the
  // redirect arrives before we're listening.
  const redirectPromise = waitForRedirect(state);
  openInBrowser(authorizeUrl);

  const data = await redirectPromise;
  if (data.error) {
    throw new Error(String(data.error_description ?? data.error));
  }
  const code = typeof data.code === "string" ? data.code : null;
  if (!code) {
    return null;
  }

  const tokenRes = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: AUTH0_CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: redirect,
    }).toString(),
  });
  if (!tokenRes.ok) {
    throw new Error(`Token exchange failed (${tokenRes.status})`);
  }

  const token = (await tokenRes.json()) as {
    id_token?: string;
    refresh_token?: string;
    /** What Auth0 granted, which is not always what was asked for. */
    scope?: string;
  };

  // Whether a refresh token came back decides whether the session can outlive
  // the id_token, and it is settled by Auth0 application settings invisible from
  // here — so it is reported rather than assumed. Presence and granted scope
  // only, never the tokens: this goes to a console anyone can open.
  console.log(
    token.refresh_token
      ? "[Readymade-login] refresh_token received — the session is renewable."
      : `[Readymade-login] No refresh_token in the token response. Granted scope: ${
          token.scope ?? "(none reported)"
        }`,
  );

  if (!token.id_token) {
    return null;
  }

  // Only now: an abandoned login leaves the old account signed in at Auth0, so
  // the next attempt still has to ask.
  clearSignedOut();

  return { idToken: token.id_token, refreshToken: token.refresh_token };
}
