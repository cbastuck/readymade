import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from 'semantic-ui-react';
import qs from 'querystring';

import { redirectUri } from '../core/actions';
import { s, t } from '../styles';

export default class Login extends Component {
  renderOpenIdLogin() {
    const { board } = this.props;
    const query = qs.stringify({
      client_id: 'hookup',
      response_type: 'code',
      scope: 'openid profile permissions features email',
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

  renderPlaceholder() {
    return (
      <div
        style={s(
          t.h100, t.fs12, t.uc, t.ls1,
          { paddingTop: '5%', width:  '50%', margin: 'auto' },
          { textAlign: 'justify', textJustify: 'inter-word' }
        )}
      >
        <div>
          User accounts are not publicly supported yet.
        </div>
        <div>
          Still in the making, to build something round and sound
        </div>
        <div style={t.mt10}>
          Please use <Link to="/playground">Playground</Link> for now ...
        </div>
        <div style={s(t.tc, t.m(0, 30))}>
          <Icon 
            name="fly"
            size="massive"
            style={{ opacity: 0.6 }} 
            color="grey" 
          />
        </div>
      </div>
    );
  }

  render() {
    const { search='' } = window.location;
    const parsed = qs.parse(search.substr(1));
    return parsed.login ? 
      this.renderOpenIdLogin() : 
      this.renderPlaceholder();
  }
}