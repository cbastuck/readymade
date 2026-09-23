import { useEffect, useRef } from "react";
import { IdToken, useAuth0 } from "@auth0/auth0-react";
import jwtDecode, { JwtPayload } from "jwt-decode";

import { usePlatform } from "./platform/PlatformContext";

/**
 * How long before a token expires its replacement is fetched. Wide enough that
 * a renewal which fails — the machine has just woken and the network is not
 * back yet, most often — has room to be tried again before anything breaks,
 * and that a request already in flight still carries a valid token.
 */
const RENEW_LEAD_MS = 5 * 60_000;

/**
 * How often the token is measured against the clock.
 *
 * Deadlines are not scheduled, they are watched for: a timer set for hours
 * ahead is the one thing a sleeping machine is sure to get wrong, and the
 * granularity only has to be fine against the lead time above.
 */
const CHECK_INTERVAL_MS = 60_000;

/** How long to wait after a renewal that changed nothing before trying again. */
const MIN_RETRY_MS = 60_000;

/** The longest that wait grows to, so a session that cannot be renewed rests. */
const MAX_RETRY_MS = 15 * 60_000;

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
    // Not a JWT we can read. Nothing to measure against.
    return null;
  }
}

/**
 * Renews the Auth0 session before it expires, rather than after.
 *
 * Restoring a session happens on load, so an app left open outlives its own
 * token: requests start failing at expiry while it still looks signed in. This
 * closes that window by renewing shortly before the token dies.
 *
 * Renders nothing. The token is not renewed on a timer set for its expiry but
 * re-measured against the clock — on an interval, and whenever the app is
 * given reason to think time has passed without it: the window regains focus,
 * the page becomes visible, the network comes back. A machine that sleeps
 * through a deadline therefore recovers on waking, and a renewal that fails is
 * simply asked again at the next measurement, waiting longer each time so a
 * session that cannot be renewed is not hammered.
 */
export default function RefreshedUser({ idToken, onToken }: Props) {
  const { getAccessTokenSilently, getIdTokenClaims } = useAuth0();
  const platform = usePlatform();
  const { refreshSession, restoreSession } = platform;
  const hostOwnsSession = Boolean(restoreSession);
  /** When the last renewal was attempted, and how long to wait after it. */
  const lastAttempt = useRef(0);
  const retryAfter = useRef(MIN_RETRY_MS);
  /** Set while a renewal is out, so the triggers cannot pile onto each other. */
  const renewing = useRef(false);

  useEffect(() => {
    // Whoever owns the session owns renewing it. A host that runs its own login
    // keeps its tokens where the Auth0 client cannot see them, so asking Auth0
    // there means a silent-auth iframe from an origin it refuses — 60s of the
    // SDK's timeout to learn nothing. Such a host renews through its own
    // capability, and where it offers none there is nothing to watch for.
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

    /** Waits longer before the next attempt, up to the cap. */
    const backOff = () => {
      retryAfter.current = Math.min(retryAfter.current * 2, MAX_RETRY_MS);
    };

    const renew = async () => {
      renewing.current = true;
      try {
        const claims = await renewedToken();
        // A renewal that hands back the token it was given has renewed nothing
        // — the same as one that hands back nothing at all. Both leave this
        // token to expire, so both wait longer before asking again.
        if (!claims?.__raw || claims.__raw === idToken) {
          backOff();
          return;
        }
        retryAfter.current = MIN_RETRY_MS;
        await onToken(claims);
        console.log("refreshed user");
      } catch (err) {
        // The session may be over, or Auth0 merely unreachable — offline is
        // what a just-woken machine looks like, and it is the common case.
        // Which it was shows in whether the next attempt succeeds.
        backOff();
        console.warn("[auth] Could not renew the session:", err);
      } finally {
        renewing.current = false;
      }
    };

    /**
     * Renews if the token is inside its lead time, or already past it.
     *
     * `ignoreBackoff` is for the one trigger that is evidence the last failure
     * no longer applies: the network coming back. Waiting out a backoff earned
     * while offline would be waiting for nothing.
     */
    const check = (ignoreBackoff = false) => {
      if (renewing.current) {
        return;
      }
      const now = Date.now();
      if (now < expiresAt - RENEW_LEAD_MS) {
        return;
      }
      if (!ignoreBackoff && now - lastAttempt.current < retryAfter.current) {
        return;
      }
      lastAttempt.current = now;
      void renew();
    };
    const onTick = () => check();
    const onOnline = () => check(true);

    console.log(
      "Watching for a user refresh, due in",
      Math.max(expiresAt - Date.now() - RENEW_LEAD_MS, 0),
    );
    // Once immediately: a token restored past its lead time — the app starting
    // up, or this component remounting — is renewed now rather than a tick from
    // now.
    check();
    const interval = setInterval(onTick, CHECK_INTERVAL_MS);
    // The interval alone cannot be trusted across a sleep. These are the moments
    // the app is told, rather than has to notice, that the world moved on.
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onTick);
    document.addEventListener("visibilitychange", onTick);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onTick);
      document.removeEventListener("visibilitychange", onTick);
    };
    // Keyed on the token itself: a new one means a new expiry to measure
    // against. The callbacks are recreated by their providers on every render,
    // so depending on them would restart the watch continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken, hostOwnsSession, refreshSession]);

  return null;
}
