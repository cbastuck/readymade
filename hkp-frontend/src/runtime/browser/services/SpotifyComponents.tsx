import { getAuthURL } from "./SpotifyAPI";
import { s, t } from "../../../styles";
import MessageReceiver from "../../../MessageReceiver";
import Button from "hkp-frontend/src/ui-components/Button";

const clientIDDefault = "e91207fc5f2e4a5db1ca562954e4c23e";
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
  clientID = clientIDDefault,
  redirectURI = redirectURIDefault,
  scopes = scopesDefault,
  state: loginStateId,
}: SpotifyOAuthProps): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Button
        style={s(t.ls1, t.fs12)}
        onClick={() => {
          const url = getAuthURL(clientID, redirectURI, scopes, loginStateId);
          window.open(url, "blank");
        }}
      >
        Login
      </Button>
      <MessageReceiver
        state={loginStateId}
        onData={(data: Record<string, unknown>) => {
          const key = "#access_token";
          data[key] && onToken(data[key] as string);
        }}
      />
    </div>
  );
}
