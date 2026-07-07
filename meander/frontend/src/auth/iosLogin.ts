import { AUTH0_CLIENT_ID, AUTH0_DOMAIN } from "./meanderLogin";

// The mobile native webviews can't run Auth0's web redirect in-page
// (custom-scheme origin) or the desktop popup relay, so login is delegated to a
// native bridge. iOS uses ASWebAuthenticationSession; Android opens the browser
// and captures the app-link callback. Both replies carry the raw id_token.
//
// The callback scheme is the bundle identifier; the resulting
// `com.readymadeit.app-ios://auth/callback` must be listed in the Auth0
// application's Allowed Callback URLs.
const IOS_CALLBACK_SCHEME = "com.readymadeit.app-ios";
const ANDROID_CALLBACK_SCHEME = "com.readymadeit.app.android";

interface AuthReply {
  idToken?: string;
  cancelled?: boolean;
}

type AuthHandler = {
  postMessage: (body: Record<string, string>) => Promise<AuthReply | undefined>;
};

function authHandler(): AuthHandler | undefined {
  const nativeHandler = (window as unknown as { hkpAuth?: AuthHandler }).hkpAuth;
  if (nativeHandler?.postMessage) {
    return nativeHandler;
  }
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
    scheme:
      (window as any).__MEANDER_ANDROID__ === true
        ? ANDROID_CALLBACK_SCHEME
        : IOS_CALLBACK_SCHEME,
  });
  return reply?.idToken ?? null;
}
