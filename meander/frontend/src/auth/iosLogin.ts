import { AUTH0_CLIENT_ID, AUTH0_DOMAIN } from "./meanderLogin";

// The iOS webview can't run Auth0's web redirect (custom-scheme origin) or the
// desktop popup relay (no window.open), so login is delegated to the native
// AuthSessionBridge: an ASWebAuthenticationSession drives the Authorization
// Code + PKCE flow and the reply carries the raw id_token.
//
// The callback scheme is the bundle identifier; the resulting
// `com.readymadeit.app-ios://auth/callback` must be listed in the Auth0
// application's Allowed Callback URLs.
const IOS_CALLBACK_SCHEME = "com.readymadeit.app-ios";

interface AuthReply {
  idToken?: string;
  cancelled?: boolean;
}

type AuthHandler = {
  postMessage: (body: Record<string, string>) => Promise<AuthReply | undefined>;
};

function authHandler(): AuthHandler | undefined {
  const webkit = (
    window as unknown as {
      webkit?: { messageHandlers?: { hkpAuth?: AuthHandler } };
    }
  ).webkit;
  return webkit?.messageHandlers?.hkpAuth;
}

/**
 * Native iOS Auth0 login; returns the raw id_token JWT, or null when the
 * user cancelled or the native bridge is missing (e.g. dev in a browser).
 */
export async function iosLogin(): Promise<string | null> {
  const handler = authHandler();
  if (!handler) {
    console.warn("[ios-login] hkpAuth bridge not available");
    return null;
  }
  const reply = await handler.postMessage({
    domain: AUTH0_DOMAIN,
    clientId: AUTH0_CLIENT_ID,
    scheme: IOS_CALLBACK_SCHEME,
  });
  return reply?.idToken ?? null;
}
