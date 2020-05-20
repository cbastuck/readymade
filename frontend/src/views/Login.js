import React, { Component } from 'react';
import qs from 'querystring';

import { redirectUri } from '../core/actions';

export default class Login extends Component {
  render() {
    const { board } = this.props;
    const query = qs.stringify({
      client_id: 'hookup',
      response_type: 'code',
      scope: 'openid profile permissions',
      redirect_uri: redirectUri(),
      state: board || ''
    });
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
          paddingTop: '5%',
        }}
      >
        <iframe 
          title="login-frame"
          src={`/openid/auth?${query}`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none'
          }}
        />
      </div>
    );
  }
}