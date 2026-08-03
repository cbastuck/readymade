import { useEffect } from "react";
import { IdToken, useAuth0 } from "@auth0/auth0-react";
import jwtDecode, { JwtPayload } from "jwt-decode";

import { usePlatform } from "./platform/PlatformContext";

/**
 * How long before a token expires its replacement is fetched. Long enough that
 * a request already in flight when the timer fires still carries a valid token,
 * short enough that the renewal is not asking for a token the session may no
 * longer justify.
 */
const RENEW_LEAD_MS = 10_000;

type Props = {
  /** The token in use, or undefined when nobody is signed in. */
  idToken?: string;
  /** Applies a renewed token, exactly as the initial restore does. */
  onToken: (claims: IdToken) => void | Promise<void>;
};

/** When the token expires, in epoch milliseconds, or null if it never says. */
function expiryOf(token: string): number | null {
  try {
    const { exp } = jwtDecode<JwtPayload>(token);
    return exp ? exp * 1000 : null;
  } catch {
    // Not a JWT we can read. Nothing to schedule against.
    return null;
  }
}

/**
 * Renews the Auth0 session before it expires, rather than after.
 *
 * Restoring a session happens on load, so a tab left open outlives its own
 * token: requests start failing at expiry while the page still looks signed in.
 * This closes that window by renewing shortly before the token dies.
 *
 * Renders nothing. Each renewed token re-triggers the schedule through the
 * user state it is applied to, so one timer is live at a time and the chain
 * continues on its own — and stops if a renewal ever returns the same token,
 * because then nothing changed to schedule against.
 */
export default function RefreshedUser({ idToken, onToken }: Props) {
  const { getAccessTokenSilently, getIdTokenClaims } = useAuth0();
  const platform = usePlatform();
  const { refreshSession, restoreSession } = platform;
  const hostOwnsSession = Boolean(restoreSession);

  useEffect(() => {
    // Whoever owns the session owns renewing it. A host that runs its own login
    // keeps its tokens where the Auth0 client cannot see them, so asking Auth0
    // there means a silent-auth iframe from an origin it refuses — 60s of the
    // SDK's timeout to learn nothing. Such a host renews through its own
    // capability, and where it offers none there is nothing to schedule.
    if (!idToken || (hostOwnsSession && !refreshSession)) {
      return;
    }
    const expiresAt = expiryOf(idToken);
    if (!expiresAt) {
      return;
    }

    /** A renewed token from whichever side of the app holds the session. */
    const renewedToken = async (): Promise<IdToken | undefined> => {
      if (refreshSession) {
        const renewed = await refreshSession();
        return renewed ? ({ __raw: renewed } as IdToken) : undefined;
      }
      // cacheMode "off" is what makes this a renewal: the cached entry is keyed
      // to the access token's lifetime, not the id_token's, so without it the
      // SDK would hand back the very token that is about to expire.
      await getAccessTokenSilently({ cacheMode: "off" });
      return await getIdTokenClaims();
    };

    const renew = async () => {
      try {
        const claims = await renewedToken();
        if (!claims) {
          return;
        }
        await onToken(claims);
        console.log("refreshed user");
      } catch (err) {
        // The session is over, or Auth0 is unreachable. Nothing here can fix
        // either; the next load restores or asks for a sign-in. (A host-owned
        // renewal reports failure as null rather than by throwing, so that
        // lands above: nothing to apply, nothing further to schedule.)
        console.warn(
          "[auth] Could not refresh the session before it expired:",
          err,
        );
      }
    };

    const renewDate = Math.max(expiresAt - Date.now() - RENEW_LEAD_MS, 0);
    console.log("Scheduling a user refresh at", renewDate);
    const timer = setTimeout(() => void renew(), renewDate);
    return () => clearTimeout(timer);
    // Keyed on the token itself: a new one means a new expiry to schedule
    // against. The callbacks are recreated by their providers on every render,
    // so depending on them would restart the timer continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken, hostOwnsSession, refreshSession]);

  return null;
}
