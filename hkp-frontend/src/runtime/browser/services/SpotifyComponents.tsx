import { useRef } from "react";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  getAuthURL,
  exchangeCodeForToken,
} from "./SpotifyAPI";
import { s, t } from "../../../styles";
import { openInBrowser } from "./helpers";
import MessageReceiver from "../../../MessageReceiver";
import Button from "hkp-frontend/src/ui-components/Button";

const redirectURIDefault = `${window.location.origin}/serviceRedirect`;
const scopesDefault = [
  "user-library-read",
  "playlist-read-private",
  "user-read-recently-played",
];

type SpotifyOAuthProps = {
  onToken: (token: string) => void;
  clientID?: string;
  redirectURI?: string;
  scopes?: string[];
  state: string;
};

export function SpotifyOAuth({
  onToken,
  clientID = "e91207fc5f2e4a5db1ca562954e4c23e",
  redirectURI = redirectURIDefault,
  scopes = scopesDefault,
  state: loginStateId,
}: SpotifyOAuthProps): JSX.Element {
  // Holds the PKCE code_verifier generated at login time so we can exchange
  // the authorization code that comes back from Spotify.
  const codeVerifierRef = useRef<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Button
        style={s(t.ls1, t.fs12)}
        onClick={async () => {

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
