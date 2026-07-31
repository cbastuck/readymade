import { useEffect, useRef } from "react";
import { IdToken, useAuth0 } from "@auth0/auth0-react";

type Props = {
  onToken: (claims: IdToken) => void;
  /**
   * Called once the Auth0 session has settled, whether or not anyone is signed
   * in — including when restoring the token failed. Callers that need
   * credentials at startup wait on this instead of polling for a user, so it
   * must fire on every terminal path or they wait forever.
   */
  onResolved?: () => void;
  /**
   * Reports a session problem the user needs to know about. Being signed out is
   * not something to discover later through failing requests, so it is said
   * plainly at the moment it happens.
   */
  onError?: (message: string) => void;
};

const EXPIRED = "token expired";

/**
 * Restores the Auth0 session into app state on load.
 *
 * Renders nothing; it exists so the restore runs inside the provider tree that
 * owns both the Auth0 client and the app's user state.
 */
export default function RestoredUser({
  onToken,
  onResolved,
  onError,
}: Props) {
  const {
    getIdTokenClaims,
    getAccessTokenSilently,
    isLoading,
    isAuthenticated,
    logout,
  } = useAuth0();

  // The restore is a side effect with a lifetime of its own; a second one
  // running concurrently would race to apply tokens. React also mounts twice in
  // development, which would otherwise start two.
  const inFlight = useRef(false);

  useEffect(() => {
    if (isLoading || inFlight.current) {
      // Still settling — a later state change re-runs this.
      return;
    }
    if (!isAuthenticated) {
      onResolved?.();
      return;
    }

    inFlight.current = true;

    /** Apply the cached ID token. Throws "token expired" when it is stale. */
    const applyCurrentToken = async (): Promise<void> => {
      const idToken: IdToken | undefined = await getIdTokenClaims();
      if (idToken) {
        await onToken(idToken);
      }
    };

    // Whether we got as far as needing a renewal. The error that ends up
    // surfacing is then the renewal's ("login required"), which describes the
    // mechanism rather than the cause — from the user's side the session simply
    // expired, and that is what they need to be told.
    let sessionExpired = false;

    const restore = async () => {
      try {
        await applyCurrentToken();
        return;
      } catch (err) {
        if ((err as Error)?.message !== EXPIRED) {
          throw err;
        }
        sessionExpired = true;
      }

      // The cached token has aged out. Ask Auth0 for a fresh one before giving
      // up — the session behind it is usually still valid, so a renewal keeps
      // the user signed in instead of interrupting them.
      await getAccessTokenSilently({ cacheMode: "off" });
      await applyCurrentToken();
    };

    void restore()
      .catch(async (err: unknown) => {
        const expired = sessionExpired;
        // Renewal failed, so the session really is over. Clear it locally
        // (no redirect) and say so, rather than leaving a signed-out user
        // looking at a board whose requests will quietly start failing.
        onError?.(
          expired
            ? "Your session has expired — please sign in again."
            : `Could not restore your session: ${
                (err as Error)?.message ?? "unknown error"
              }`,
        );
        try {
          await logout({ openUrl: false });
        } catch {
          // Already signed out, or the SDK refused — nothing further to do.
        }
      })
      .finally(() => {
        inFlight.current = false;
        onResolved?.();
      });
    // Deliberately keyed on the Auth0 state only: the callbacks are recreated
    // every render by their providers, and depending on them would restart the
    // restore on each one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated]);

  return null;
}
