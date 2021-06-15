

import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';

import Github from './Github';
import ServiceUI from './ServiceUI';
import { s, t } from '../../styles';
import InputField from '../../components/shared/InputField';
import MessageReceiver from '../../MessageReceiver';

const serviceId = 'hookup.to/service/github-source';
const serviceName = 'Github Source';

const loginStateId = 'github-login';

const clientID = 'f2b34053a831baa056e8';
const clientSecret = '';
const redirectURI = `${window.location.origin}/serviceRedirect`;
const scopes = [];


class GithubSourceUI extends Component {
  state = {};

  onInit = initialState => {
    const { 
      token,
    } = initialState;
    this.setState({ token });
  }

  onNotification = (service, notification) => {
    const { token } = notification;
    if (token) {
      this.setState({ token });
    }
  }

  onLogin = service => {
    const url = service.configure({ 
      action: 'login',
      clientID,
      clientSecret,
      scopes,
      redirectURI,
      state: loginStateId,
    });
    if (url) {
      window.open(url, 'blank');
    }
  }

  renderLoginPanel = service => clientSecret ? 
    this.renderOAuthFlow(service) : 
    this.renderBasicAuth(service)

  renderOAuthFlow = service => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Button
        style={s(t.uc, t.ls1, t.fs12)}
        onClick={() => this.onLogin(service)}
      >
        Login
      </Button>
      <MessageReceiver
        state={loginStateId}
        onData={async data => {
          const { code } = data;
          if (code) {
            service.configure({ 
              action: 'exchangeCode',
              clientID, 
              clientSecret,
              code,
              redirectURI,
            })
          }
        }}
      />
    </div>
  )

  renderBasicAuth = service => {
    const { token } = this.state;
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <InputField 
          label="Token"
          value={token}
          onChange={(_, { value: token }) => 
            service.configure({ token })
          }
        />
      </div>
    )
  }

  renderGithubPanel = service => (
    <div>
      <Button
        style={s(t.uc, t.ls1, t.fs12)}
        onClick={() => service.configure({ action: 'getUser' })}
      >
        Get User
      </Button>
    </div>
  )

  render() {
    const { token } = this.state;
    const segments=[
      { name: 'Login', render: this.renderLoginPanel },
      { name: 'Github', render: this.renderGithubPanel, disabled: !token },
    ];
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit.bind(this)}
        onNotification={this.onNotification.bind(this)}
        segments={segments}
      />
    )
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Github(app, board, descriptor, id),
  createUI: GithubSourceUI,
};

export default descriptor;
