import React, { Component } from "react";
import { Redirect } from "react-router-dom";

import { AppConsumer } from "../AppContext";
import { redirectUri } from "../core/actions";
import { popItem } from "../core/storage";

export default class AuthRedirect extends Component {
  constructor(props) {
    super(props);
    this.state = {
      tokenUpdated: false,
      token: null,
    };

    // TODO: this checks if we're in an iframe and
    // if so delegates the request to the parent.
    // This logic should not be here
    if (window.parent !== window) {
      // TODO: we should not do this here
      window.parent.location.href = window.location.href;
    } else {
      const { location } = props;
      this.queryParams = Object.fromEntries(
        new URLSearchParams(location.search.substr(1))
      );
      if (this.queryParams.code) {
        this.exchangeCodeForToken(this.queryParams.code);
      }
    }
  }

  exchangeCodeForToken = async (code) => {
    const clientId = "hookup";
    const pkceVerifier = popItem("pkce_verifier");
    const response = await fetch("/openid/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body: qs.stringify({
        client_id: clientId,
        client_secret: "hkp",
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
        code,
        code_verifier: pkceVerifier,
      }),
    });

    const result = await response.json();
    if (result && result.id_token) {
      this.setState({ token: result.id_token });
    }
  };

  render() {
    if (!this.queryParams) {
      return false;
    }

    if (this.queryParams.error) {
      return (
        <Redirect
          to={{
            pathname: "/loginFail",
            state: { errorMessage: this.queryParams.error },
          }}
        />
      );
    }

    const { token, tokenUpdated } = this.state;

    if (!token) {
      return false;
    }

    return (
      <AppConsumer>
        {(appContext) => {
          if (!tokenUpdated) {
            appContext
              .updateToken(token)
              .then(() => this.setState({ tokenUpdated: true }));
            return false;
          } else {
            return this.queryParams.state ? (
              <Redirect to={`/${this.queryParams.state}`} />
            ) : (
              <Redirect to="/" />
            );
          }
        }}
      </AppConsumer>
    );
  }
}
