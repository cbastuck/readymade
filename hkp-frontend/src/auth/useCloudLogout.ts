import { useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";

import { usePlatform } from "../platform/PlatformContext";
import { useAppContext } from "../AppContext";

/**
 * Returns a logout trigger that fully ends the session.
 *
 * Clearing only the app user (AppContext.logout) is not enough: the Auth0 SPA
 * session persists, so `isAuthenticated` stays true and RestoredUser silently
 * re-restores the user on the next render — making logout appear to do nothing.
 *
 * - When the platform owns the session (e.g. a native logout), defer to it. That
 *   branch also covers the native webview, where a redirect would navigate away
 *   from the app.
 * - Otherwise log out at Auth0 itself, not just locally. Clearing only the local
 *   session leaves the identity provider's SSO cookie in place, so the next
 *   login skips the credentials form and goes straight to consent for the same
 *   account — logging out appears to work while making it impossible to sign in
 *   as anyone else.
 *
 * Always clears the app user afterwards.
 *
 * Note: `returnTo` must be registered in the Auth0 application's Allowed Logout
 * URLs for every origin the app is served from, or Auth0 rejects the redirect.
 */
export function useCloudLogout(): () => Promise<void> {
  const platform = usePlatform();
  const { logout: auth0Logout } = useAuth0();
  const { logout: clearAppUser } = useAppContext();

  return useCallback(async () => {
    try {
      if (platform.logout) {
        await platform.logout();
      } else {
        await auth0Logout({
          logoutParams: { returnTo: window.location.origin },
        });
      }
    } finally {
      await clearAppUser();
    }
  }, [platform, auth0Logout, clearAppUser]);
}
