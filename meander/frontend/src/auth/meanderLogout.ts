import { openInBrowser } from "hkp-frontend/src/runtime/browser/services/helpers";

import { AUTH0_CLIENT_ID, AUTH0_DOMAIN } from "./meanderLogin";
import { clearSession } from "./session";

/**
 * Ends a native login properly: the stored token *and* the Auth0 session.
 *
 * The native flow signs in through the system browser, so that is where Auth0's
 * SSO cookie lives. Dropping only the local token leaves it in place, and the
 * next login skips the credentials form and offers consent for the same account
 * — logout appears to work while making it impossible to sign in as anyone else.
 *
 * No `returnTo` is sent: it would have to be registered in the Auth0
 * application's Allowed Logout URLs, and there is nothing to come back to. The
 * browser lands on Auth0's own confirmation page instead.
 */
export async function meanderLogout(): Promise<void> {
  clearSession();
  openInBrowser(
    `https://${AUTH0_DOMAIN}/v2/logout?client_id=${encodeURIComponent(AUTH0_CLIENT_ID)}`,
  );
}
