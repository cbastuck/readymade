import React, { Component } from "react";
import { Button } from "semantic-ui-react";

import { getAuthURL } from "./SpotifyAPI";
import { s, t } from "../../styles";
import MessageReceiver from "../../MessageReceiver";

const clientIDDefault = "e91207fc5f2e4a5db1ca562954e4c23e";
const redirectURIDefault = `${window.location.origin}/serviceRedirect`;
const scopesDefault = [
  "user-library-read",
  "playlist-read-private",
  "user-read-recently-played",
];

export class SpotifyOAuth extends Component {
  render() {
    const {
      onToken,
      clientID = clientIDDefault,
      redirectURI = redirectURIDefault,
      scopes = scopesDefault,
      state: loginStateId,
    } = this.props;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Button
          style={s(t.uc, t.ls1, t.fs12)}
          onClick={() => {
            const url = getAuthURL(clientID, redirectURI, scopes, loginStateId);
            window.open(url, "blank");
          }}
        >
          Login
        </Button>
        <MessageReceiver
          state={loginStateId}
          onData={(data) => data.access_token && onToken(data.access_token)}
        />
      </div>
    );
  }
}
