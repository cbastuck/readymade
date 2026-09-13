import { useCallback } from "react";
import { IdToken, useAuth0 } from "@auth0/auth0-react";
import { toast } from "sonner";

import { usePlatform } from "../platform/PlatformContext";
import { useAppContext } from "../AppContext";
import { isWebLoginAvailable } from "./Auth0Provider";

/**
 * Whether logging in is possible at all here.
 *
 * A host with its own `login` can always do it. Otherwise it takes the web
 * redirect flow, which only exists on an origin Auth0 will redirect back to —
 * see `isWebLoginAvailable`.
 *
 * Callers that render a login control should hide or disable it when this is
 * false: without a provider the SDK's methods are stubs that throw, so the
 * control would do nothing but raise "You forgot to wrap your component in
 * <Auth0Provider>".
 */
export function useCanCloudLogin(): boolean {
  const platform = usePlatform();
  return !!platform.login || isWebLoginAvailable();
}

/**
 * Returns a login trigger that adapts to the host platform:
 *
 * - When the platform provides its own `login` (e.g. the native Readymade app,
 *   which can't use Auth0's web redirect), run it and feed the resulting raw
 *   id_token into the app session via `updateToken`.
 * - Otherwise fall back to the standard Auth0 single-page redirect flow.
 *
 * The web fallback needs an `<Auth0Provider>` ancestor, which is absent on the
 * origins `isWebLoginAvailable` rejects. Logging in there says so in a toast
 * rather than throwing: every caller fires this from a click handler and
 * discards the promise, so a throw would surface only as an unhandled
 * rejection — a button that appears to do nothing, with the reason visible
 * only to whoever thinks to open a console. Use `useCanCloudLogin` to avoid
 * offering the action in the first place.
 */
export function useCloudLogin(): () => Promise<void> {
  const platform = usePlatform();
  const { loginWithRedirect } = useAuth0();
  const { updateToken } = useAppContext();
  const canLogin = useCanCloudLogin();

  return useCallback(async () => {
    if (platform.login) {
      const idToken = await platform.login();
      if (idToken) {
        await updateToken({ __raw: idToken } as IdToken);
      }
      return;
    }
    if (!canLogin) {
      console.warn(
        `Cannot log in from ${location.origin}: it is not a registered Auth0 callback origin.`,
      );
      toast.warning("Signing in is not available here", {
        description:
          "This page is served from a local network address, which the sign-in provider will not redirect back to. A board opened from a shared link is already authorized by the link itself.",
      });
      return;
    }
    await loginWithRedirect({
      appState: { returnTo: window.location.href },
    });
  }, [platform, canLogin, loginWithRedirect, updateToken]);
}
