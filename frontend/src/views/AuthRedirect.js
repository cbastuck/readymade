import React, { Component } from 'react';
import { Redirect } from 'react-router-dom';
import qs from 'querystring';

import { AppConsumer } from '../AppContext'
import {
  redirectUri,
  finishPendingLoginRequest
} from '../core/actions';

const clientId = 'oidcCLIENT';
const clientSecret = 'test';

export default class AuthRedirect extends Component {
  constructor(props) {
    super(props);
    this.state = {};

    // TODO: this checks if we're in an iframe and
    // if so delegates the request to the parent.
    // This logic should not be here
    if (window.parent !== window) {
      window.parent.location.href = window.location.href;
    } else {
      const { location } = props;
      this.queryParams = qs.parse(location.search.substr(1));
      if (this.queryParams.code) {
        this.exchangeCodeForToken(this.queryParams.code)
          .then(() => finishPendingLoginRequest(true));
      } else {
        finishPendingLoginRequest(false);
      }
    }
  }

  exchangeCodeForToken = async code => {
    const response = await fetch(
      `/openid/token`,
      {
         method: 'POST',
         headers: {
           'Content-Type': 'application/x-www-form-urlencoded',
           'Cache-Control': 'no-cache',
         },
         body: qs.stringify({
           client_secret: clientSecret,
           client_id: clientId,
           redirect_uri: redirectUri(),
           grant_type: 'authorization_code',
           code: code,
          }
        )
      }
    );
    const result = await response.json();
    if (result && result.id_token) {
      this.setState({ token: result.id_token });
    }
  }

  render() {
    if (!this.queryParams) {
      return false;
    }

    if (this.queryParams.error) {
      return (
        <Redirect 
          to={{
            pathname: '/loginFail',
            state: { errorMessage: this.queryParams.error }
          }}
        />
      );
    }

    const token = this.state && this.state.token;
    if (!token) {
      return false;
    }

    return (
      <AppConsumer>
        {
          appContext => {
            appContext.updateToken(this.state.token);
            return this.queryParams.state ?
              <Redirect to={`/${this.queryParams.state}`}/>  :
              <Redirect to="/" />
          }
        }
      </AppConsumer>
    );
  }
}
