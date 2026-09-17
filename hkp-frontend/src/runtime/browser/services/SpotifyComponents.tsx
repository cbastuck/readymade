import { useRef } from "react";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  getAuthURL,
  exchangeCodeForToken,
} from "./SpotifyAPI";
import { s, t } from "../../../styles";
import {
  canReceiveServiceRedirect,
  openInBrowser,
  serviceRedirectUri,
} from "./helpers";
import { toast } from "sonner";
import MessageReceiver from "../../../MessageReceiver";
import Button from "hkp-frontend/src/ui-components/Button";

/**
 * Where Spotify sends the user back after login.
 *
 * Spotify accepts a loopback callback only as a literal 127.0.0.1, never as
 * "localhost" — hence the override for a plain-http page. In the desktop app
 * the helper returns a loopback address of its own (the app's own HTTP server),
 * which satisfies the same rule.
 */
export function spotifyRedirectUri(): string {
  return serviceRedirectUri(
    window.location.protocol === "http:"
      ? `http://127.0.0.1:${window.location.port}`
      : undefined,
  );
}

const scopesDefault = [
  "user-library-read",
  "playlist-read-private",
  "user-read-recently-played",
];

type SpotifyOAuthProps = {
  onToken: (token: string) => void;
  clientID?: string;
  /** Defaults to `spotifyRedirectUri`. */
  redirectURI?: string;
  scopes?: string[];
  state: string;
};

export function SpotifyOAuth({
  onToken,
  clientID = "e91207fc5f2e4a5db1ca562954e4c23e",
  redirectURI = spotifyRedirectUri(),
  scopes = scopesDefault,
  state: loginStateId,
}: SpotifyOAuthProps): JSX.Element {
  // Holds the PKCE code_verifier generated at login time so we can exchange
  // the authorization code that comes back from Spotify.
  const codeVerifierRef = useRef<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Button
        className="hkp-svc-btn"
        style={s(t.ls1, t.fs12)}
        onClick={async () => {
          if (!canReceiveServiceRedirect()) {
            toast.error("Another Readymade instance is running", {
              description:
                "It holds the port Spotify would send you back to, so this window would never see the login. Quit it and try again.",
            });
            return;
          }

          const verifier = generateCodeVerifier();
          codeVerifierRef.current = verifier;
          const challenge = await generateCodeChallenge(verifier);
          const url = getAuthURL(clientID, redirectURI, scopes, loginStateId, challenge);
          openInBrowser(url);
        }}
      >
        Login
      </Button>
      <MessageReceiver
        state={loginStateId}
        onData={async (data: Record<string, unknown>) => {
          // PKCE flow: Spotify redirects with ?code=… (not #access_token=…)
          if (data.code && codeVerifierRef.current) {
            try {
              const token = await exchangeCodeForToken(
                data.code as string,
                codeVerifierRef.current,
                redirectURI,
                clientID
              );
              onToken(token);
            } catch (err) {
              console.error("Spotify token exchange failed", err);
            }
          }
        }}
      />
    </div>
  );
}
