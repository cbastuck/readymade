

import React, { Component } from 'react';
import { Button, Card, Icon, Image } from 'semantic-ui-react';

import Github from './Github';
import ServiceUI from './ServiceUI';
import { s, t } from '../../styles';
import InputField from '../../components/shared/InputField';
import SelectorField from '../../components/shared/SelectorField';
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
      repos 
    } = notification;
    if (token) {
      this.setState({ token });
    }

    if (user !== undefined) {
      this.setState({ user });
    }

    if (repos !== undefined) {
      this.setState({ repos });
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

  renderUser = (service, user) => {
    const { 
      login, 
      avatar_url, 
      created_at,
      public_repos,
      followers
    } = user;
    return (
      <div>
        <Card>
          <Image src={avatar_url} wrapped ui={false} />
          <Card.Content>
            <Card.Header>{ login }</Card.Header>
            <Card.Meta>Joined in {created_at}</Card.Meta>
            <Card.Description>
              The user has {public_repos} public repositories
            </Card.Description>
          </Card.Content>
          <Card.Content extra>
            <Icon name='user' />
            {followers} Followers 
          </Card.Content>
        </Card>
        <Button>
          Logout
        </Button>
      </div>
    )
  }

  renderLoginPanel = service => {
    const { token, user } = this.state;
    if (token) {
      if (!user) {
        service.configure({ action: 'getUser' });
      } else {
        return this.renderUser(service, user);
      }
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
          onChange={(_, { value: token }) => 
            service.configure({ token })
          }
        />
      </div>
    )
  }

  renderGithubPanel = service => {
    const { user, repos } = this.state;
    if (!user) {
      return false;
    }
    if (!repos) {
      service.configure({ action: 'getRepos', owner: user.login});
      return false;
    }
    const options = repos.reduce(
      (all, cur) => ({...all, [cur.name]: cur.name}), {}
    ); 
    return (
      <div>
        <InputField 
          label="Owner"
          value={user.login}
          onChange={(_, { value: owner }) => {
            service.configure({ owner })
          }}
        />
        <SelectorField
          label="repository"
          options={options}
          value="hkp"
          onChange={(_, { value: repository }) => {
            service.configure({ repository })
          }}
        />
        <InputField 
          label="Branch"
          onChange={(_, { value: branch }) => {
            service.configure({ branch })
          }}
        />
        <InputField 
          label="Filename"
          onChange={(_, { value: filename }) => {
            service.configure({ filename })
          }}
        />
      </div>
    );
  }

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
  createUI: GithubSinkUI,
};

export default descriptor;
