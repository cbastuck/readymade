import React, { Component } from "react";
import { Navigate } from "react-router-dom";

import { withRouter } from "../common";
import { AppConsumer } from "../AppContext";
import { redirectUri } from "../core/actions";
import { popItem } from "../core/storage";
import LoginCheckMail from "./LoginCheckMails";

type AuthRedirectProps = {
  location: {
    search: string;
  };
  [key: string]: any;
};

type AuthRedirectState = {
  tokenUpdated: boolean;
  token: string | null;
  step: string;
};

class AuthRedirect extends Component<AuthRedirectProps, AuthRedirectState> {
  queryParams: Record<string, string> | undefined;

  constructor(props: AuthRedirectProps) {
    super(props);
    // TODO: this checks if we're in an iframe and
    // if so delegates the request to the parent.
    // This logic should not be here
    let initialStep = "init";
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
      } else if (this.queryParams.step !== undefined) {
        initialStep = this.queryParams.step;
      }
    }

    this.state = {
      tokenUpdated: false,
      token: null,
      step: initialStep,
    };
  }

  exchangeCodeForToken = async (code: string): Promise<void> => {
    const clientId = "hookup";
    const pkceVerifier = popItem("pkce_verifier");
    const response = await fetch("/openid/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: "hkp",
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
        code,
        code_verifier: pkceVerifier ?? "",
      }).toString(),
    });

    const result = await response.json();
    if (result && result.id_token) {
      this.setState({ token: result.id_token });
    }
  };

  render(): React.ReactNode {
    if (!this.queryParams) {
      return false;
    }

    if (this.queryParams.error) {
      return (
        <Navigate
          to="/loginFail"
          state={{ errorMessage: this.queryParams.error }}
        />
      );
    }

    const { token, tokenUpdated, step } = this.state;

    if (step === "mailsent") {
      return <LoginCheckMail />;
    }

    if (!token) {
      return false;
    }

    return (
      <AppConsumer>
        {(appContext: any) => {
          if (!tokenUpdated) {
            appContext
              .updateToken(token)
              .then(() => this.setState({ tokenUpdated: true }));
            return false;
          } else {
            return this.queryParams!.state ? (
              <Navigate to={`/${this.queryParams!.state}`} />
            ) : (
              <Navigate to="/" />
            );
          }
        }}
      </AppConsumer>
    );
  }
}

export default withRouter(AuthRedirect);
