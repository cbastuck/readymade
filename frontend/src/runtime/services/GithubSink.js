

import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';

import Github from './Github';
import { GithubUser, GithubObject } from './GithubComponents';
import ServiceUI from './ServiceUI';
import { s, t } from '../../styles';
import InputField from '../../components/shared/InputField';
import MessageReceiver from '../../MessageReceiver';

const serviceId = 'hookup.to/service/github-sink';
const serviceName = 'Github Sink';

const loginStateId = 'github-login';

const clientID = 'f2b34053a831baa056e8';
const clientSecret = '';
const redirectURI = `${window.location.origin}/serviceRedirect`;
const scopes = [];

class GithubSinkUI extends Component {
  state = {};

  onInit = initialState => {
    const { 
      token,
    } = initialState;
    this.setState({ token });
  }

  onNotification = (service, notification) => {
    const { 
      token, 
      user,
    } = notification;
    if (token) {
      this.setState({ token });
    }

    if (user !== undefined) {
      this.setState({ user });
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

  renderLoginPanel = service => {
    const { token } = this.state;
    if (token) {
      return <GithubUser token={token} />;
    }
    return clientSecret ? 
      this.renderOAuthFlow(service) : 
      this.renderBasicAuth(service)
  }

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
          onChange={(_, { value: token }) => service.configure({ token })}
        />
      </div>
    )
  }

  renderObjectSelector = service => {
    const { token } = this.state;
    if (!token) {
      return false;
    }
    return <GithubObject token={token} />;
  }

  render() {
    const { token } = this.state;
    const segments=[
      { name: 'User', render: this.renderLoginPanel },
      { name: 'Select', render: this.renderObjectSelector, disabled: !token },
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
  createUI: GithubSinkUI,
};

export default descriptor;
