import React, { Component } from 'react';
import { Redirect } from 'react-router-dom';
import qs from 'querystring';

import { AppConsumer } from '../AppContext'
import { redirectUri, redirectTo } from '../core/actions';

const clientId = 'oidcCLIENT';
const clientSecret = 'test';

export default class AuthRedirect extends Component {
  constructor(props) {
    super(props);

    const { location } = props;
    const params = qs.parse(location.search.substr(1));

    this.state = {
      error: params.error,
      board: params.state
    };

    if (params.code) {
      this.exchangeCodeForToken(params.code);
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

  renderError = error => {
    switch(error) {
      case 'access_denied':
      case 'login_required':
        return redirectTo('/');
      default:
        return <div>Unknown Error</div>;
    }
  }

  render() {
    if (this.state.error) {
      return this.renderError(this.state.error);
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
            return this.state.board ?
              <Redirect to={`/${this.state.board}`}/>  :
              <Redirect to="/" />
          }
        }
      </AppConsumer>
    );
  }
}
