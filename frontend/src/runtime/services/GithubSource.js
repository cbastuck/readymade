import React, { Component } from 'react';
import { 
  Button, 
} from 'semantic-ui-react';

import ServiceUI from './ServiceUI';
import InputField from '../../components/shared/InputField';
import {
  GithubUser, 
  GithubObject, 
  GithubOAuth 
} from './GithubComponents';
import { getFile } from './GithubAPI';
import { s, t } from '../../styles';


const serviceId = 'hookup.to/service/github-source';
const serviceName = 'Github Source';

const clientID = 'f2b34053a831baa056e8';
const clientSecret = '';
const redirectURI = `${window.location.origin}/serviceRedirect`;
const scopes = [];

class GithubSourceUI extends Component {
  state = {};

  onInit = initialState => {
    const { 
      token,
      owner,
      repo,
      branch,
      file,
    } = initialState;
    this.setState({ token, owner, repo, branch, file });
  }

  onNotification = (service, notification) => {
    const { 
      token, 
      user,
      owner,
      repo,
      branch,
      file,
    } = notification;
    if (token) {
      this.setState({ token });
    }

    if (user !== undefined) {
      this.setState({ user });
    }

    if (owner !== undefined) {
      this.setState({ owner })
    }

    if (repo !== undefined) {
      this.setState({ repo });
    }

    if (branch !== undefined) {
      this.setState({ branch })
    }

    if (file !== undefined) {
      this.setState({ file });
    }
  }

  renderLoginPanel = service => {
    const { token } = this.state;
    if (token) {
      return (
        <GithubUser 
          token={token}
          onUser={user => {
            if (!this.state.owner) {
              const owner = user.login;
              this.setState({ owner });
              service.configure({ owner });
            }
          }}
        />
      );
    }
    return clientSecret ? 
      <GithubOAuth
        clientID={clientID}
        clientSecret={clientSecret}
        redirectURI={redirectURI}
        scopes={scopes}
        onToken={token => this.setState({ token })}
      /> : 
      this.renderBasicAuth(service)
  }

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
    const { 
      token,
      owner,
      repo,
      branch,
      file,
    } = this.state;
    if (!token) {
      return false;
    }
    return (
      <div>
        <GithubObject
          token={token}
          owner={owner}
          repo={repo}
          branch={branch}
          file={file}
          disableNewFiles={true}
          onChange={kv => service.configure(kv)}
        />
        <Button
          style={s(t.uc, t.ls1, t.fs12, t.w100)}
          onClick={() => this.inject(service)}
        >
          Inject
        </Button>
      </div>
    );
  }

  inject = async service => {
    const {
      token,
      owner, 
      repo,
      branch,
      file
    } = this.state;
    const content = await getFile(token, owner, repo, branch, file);
    if (content) {
      service.inject(content);
    }
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

class GithubSource {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.token = ''; //this.app.restoreServiceData(this.uuid, loginStateId);
    this.owner = '';
    this.repo = '';
    this.branch = '';
    this.file = '';
  }

  async configure(config) { 
    const { 
      token,
      owner,
      repo,
      branch, 
      file
    } = config;
    if (token !== undefined) {
      this.token = token;
      this.app.notify(this, { token });
    }

    if (owner !== undefined) {
      this.owner = owner;
      this.app.notify(this, { owner });
    }

    if (repo !== undefined) {
      this.repo = repo;
      this.app.notify(this, { repo });
    }

    if (branch !== undefined) {
      this.branch = branch;
      this.app.notify(this, { branch });
    }

    if (file !== undefined) {
      this.file = file;
      this.app.notify(this, { file });
    }
  }
  
  destroy() { }

  inject(params) {
    return this.app.next(this, params);
  }

  process(params) {
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new GithubSource(app, board, descriptor, id),
  createUI: GithubSourceUI,
};

export default descriptor;
