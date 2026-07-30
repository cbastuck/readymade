import { useEffect, useRef } from "react";
import { IdToken } from "@auth0/auth0-react";

import { usePlatform } from "./platform/PlatformContext";

type Props = {
  onToken: (claims: IdToken) => void | Promise<void>;
  /**
   * Called once the platform session has settled, signed in or not. Must fire on
   * every terminal path: startup waits on it before treating the auth state as
   * known.
   */
  onResolved: () => void;
  onError?: (message: string) => void;
};

/**
 * Restores a host-owned session into app state on load.
 *
 * The counterpart to RestoredUser for hosts that run their own login instead of
 * the Auth0 web flow (the native Readymade app). Those tokens live nowhere the
 * Auth0 client can see, so without this a reload signs the user out and every
 * authenticated runtime call starts failing with a 401.
 *
 * Renders nothing, and does nothing at all on hosts without the capability.
 */
export default function RestoredPlatformUser({
  onToken,
  onResolved,
  onError,
}: Props) {
  const platform = usePlatform();
  const restoreSession = platform.restoreSession;
  const started = useRef(false);

  useEffect(() => {
    if (!restoreSession || started.current) {
      return;
    }
    started.current = true;

    void (async () => {
      try {
        const idToken = await restoreSession();
        if (idToken) {
          await onToken({ __raw: idToken } as IdToken);
        }
      } catch (err) {
        // A failed restore is a signed-out start, not a broken app — but say so,
        // because the alternative is the user discovering it through a 401.
        onError?.(
          `Could not restore your session: ${
            (err as Error)?.message ?? "unknown error"
          }`,
        );
      } finally {
        onResolved();
      }
    })();
    // Runs once per mount: the capability is fixed for the host's lifetime, and
    // the callbacks are recreated by their provider on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
