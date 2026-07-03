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
 * - When the platform owns the session (e.g. a native logout), defer to it.
 * - Otherwise clear the Auth0 session locally with `openUrl: false` so no
 *   redirect navigates the native webview away from the app.
 *
 * Always clears the app user afterwards.
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
        await auth0Logout({ openUrl: false });
      }
    } finally {
      await clearAppUser();
    }
  }, [platform, auth0Logout, clearAppUser]);
}
