import React, { Component } from 'react';
import { Redirect } from 'react-router-dom';
import moment from 'moment';
import qs from 'querystring';

const clientId = 'oidcCLIENT';
const clientSecret = 'test';
const callbackUrl = 'http://localhost/auth2app';

export default class AuthRedirect extends Component {
  constructor(props) {
    super(props);
    const { location } = props;

    const params = qs.parse(location.search.substr(1));
    this.exchangeCodeForToken(params.code);
  }

  exchangeCodeForToken = async code => {
    const response = await fetch(
      `http://localhost/openid/token`,
      {
         method: 'POST',
         headers: {
           'Content-Type': 'application/x-www-form-urlencoded',
           'Cache-Control': 'no-cache',
         },
         body: qs.stringify({
           client_secret: clientSecret,
           client_id: clientId,
           redirect_uri: callbackUrl,
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
    const token = this.state && this.state.token;
    if (!token) {
      return false;
    }
    const exp = moment.utc().add(1, 'd').toString();
    document.cookie = `token=${this.state.token}; expires=${exp}`;
    return <Redirect to="/" />
  }
}
