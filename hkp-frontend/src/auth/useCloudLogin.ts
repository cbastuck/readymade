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
 * - Otherwise sign in through an Auth0 popup, and only fall back to the
 *   single-page redirect when the browser refuses to open one. A redirect
 *   navigates the page away, and a board is built in memory: the user comes
 *   back signed in to an empty playground, having lost the thing they signed in
 *   to keep. The popup leaves the page running and the SDK's state updates in
 *   place when it closes.
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
  const { loginWithPopup, loginWithRedirect } = useAuth0();
  const { updateToken } = useAppContext();
  const canLogin = useCanCloudLogin();

  return useCallback(async () => {
    if (platform.login) {
      // A platform login runs outside this window — a browser, a native sheet —
      // and can fail for reasons only it knows. Said in a toast for the same
      // reason as below: the promise is discarded by every caller.
      try {
        const idToken = await platform.login();
        if (idToken) {
          await updateToken({ __raw: idToken } as IdToken);
        }
      } catch (err) {
        console.error("Sign-in failed", err);
        toast.error("Signing in failed", {
          description: err instanceof Error ? err.message : String(err),
        });
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
    try {
      await loginWithPopup();
    } catch (err) {
      // Codes from auth0-spa-js: the user closed the popup, let it sit until it
      // timed out, or never got one because the browser blocked it.
      const code = (err as { error?: string })?.error;
      if (code === "cancelled" || code === "timeout") {
        return;
      }
      if (code === "popup_open") {
        // Redirecting is the only way left to sign in, and it costs whatever is
        // on the page — so it is offered rather than done, with the cheaper fix
        // named first.
        toast.warning("Your browser blocked the sign-in window", {
          description:
            "Allow pop-ups for this site and try again, or sign in on a new page — which will discard an unsaved board.",
          action: {
            label: "Sign in on a new page",
            onClick: () => {
              void loginWithRedirect({
                appState: { returnTo: window.location.href },
              });
            },
          },
        });
        return;
      }
      console.error("Sign-in failed", err);
      toast.error("Signing in failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, [platform, canLogin, loginWithPopup, loginWithRedirect, updateToken]);
}
