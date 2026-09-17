import { clearSession, markSignedOut } from "./session";

/**
 * Ends a native login, without leaving the app.
 *
 * Signing out happens here and nowhere else: no window, no browser, nothing for
 * the user to dismiss. That is a choice about where it happens rather than what
 * it can reach — Auth0's session belongs to whichever browser the login ran in,
 * and neither a fetch from the webview nor a webview of our own carries that
 * browser's cookies, so no amount of loading `/v2/logout` from inside the app
 * would end it. Sending the user out to the browser to do it is the only thing
 * that would, at the cost of handing them a stray tab and a provider's page.
 *
 * What is left behind is a session at Auth0 that would sign the same account
 * back in unasked, so the sign-out is recorded and the next login asks who is
 * signing in (see `wasSignedOut`). Signing in as somebody else stays possible;
 * it just costs a form the browser fills in.
 */
export async function meanderLogout(): Promise<void> {
  clearSession();
  markSignedOut();
}
