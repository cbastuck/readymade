import { useCallback } from "react";
import { IdToken, useAuth0 } from "@auth0/auth0-react";

import { usePlatform } from "../platform/PlatformContext";
import { useAppContext } from "../AppContext";

/**
 * Returns a login trigger that adapts to the host platform:
 *
 * - When the platform provides its own `login` (e.g. the native Meander app,
 *   which can't use Auth0's web redirect), run it and feed the resulting raw
 *   id_token into the app session via `updateToken`.
 * - Otherwise fall back to the standard Auth0 single-page redirect flow.
 *
 * Requires an `<Auth0Provider>` ancestor for the web fallback (present in both
 * the website and the Meander webview today).
 */
export function useCloudLogin(): () => Promise<void> {
  const platform = usePlatform();
  const { loginWithRedirect } = useAuth0();
  const { updateToken } = useAppContext();

  return useCallback(async () => {
    if (platform.login) {
      const idToken = await platform.login();
      if (idToken) {
        await updateToken({ __raw: idToken } as IdToken);
      }
      return;
    }
    await loginWithRedirect({
      appState: { returnTo: window.location.href },
    });
  }, [platform, loginWithRedirect, updateToken]);
}
