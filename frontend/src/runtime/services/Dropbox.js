import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';

import { Dropbox as DBox } from 'dropbox';

import ServiceUI from './ServiceUI';
import MessageReceiver from '../../MessageReceiver';

const serviceId = 'hookup.to/service/dropbox';
const serviceName = 'Dropbox';

const clientId = '1gederbui19m8pk';
const loginStateId = 'hkp-db-login';
const redirectURI = 'http://localhost/serviceRedirect';

class DropboxUI extends Component {
  state = {
    files: [],
    user: undefined,
  };

  componentDidMount() {
    MessageReceiver.registerRedirect(
      loginStateId,
      async data => {
        const accessToken = data.access_token;
        this.service.configure({ accessToken });
        const user = await this.service.getUserAccount();
        this.setState({ user });
      }
    );
  }

  onInit = service => {
    this.service = service;
  }

  onLogin = async () => {
    const authUrl = this.service.getAuthUrl();
    window.open(authUrl, 'blank');
  }

  renderLoginPanel() {
    return (
      <div>
        <Button 
          style={{ width: '100%' }}
          onClick={() => this.onLogin()}
        >
          Login
        </Button>
      </div>
    ); 
  }

  renderFilesPanel() {
    return (
      <div>
        User: { this.state.user.email }
      </div>
    );
  }

  renderMain = () => {
    if (!this.state.user) {
      return this.renderLoginPanel();     
    }
    return this.renderFilesPanel();
  }

  render() {
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit.bind(this)}
        segments={[
          { name: 'Main', render: this.renderMain },
        ]}
      />
    )
  }
}

class Dropbox {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.dbx = new DBox({ clientId, fetch });
  }

  configure(config) {
    const { accessToken, download } = config;
    if (accessToken !== undefined) {
      this.dbx.setAccessToken(accessToken);
      this.trigger();
    }

    if (download !== undefined) {
      this.download = download;
    }
  }

  getAuthUrl() {
    return this.dbx.getAuthenticationUrl(redirectURI, loginStateId);
  }

  getUserAccount() {
    return this.dbx.usersGetCurrentAccount();
  }

  async retrieveFiles() {
    const response = await this.dbx.filesListFolder({ path: '' });
    return response.entries;
  }

  async trigger(params) {
    const data = await this.process(params);
    await this.app.next(this, data);
  }

  async process(params) {
    if (this.download) {
      const files = await this.retrieveFiles();
      const file = files.find(f => f.name === this.download);
      if (file) {
        const downloaded = await this.dbx.filesDownload({ path: file.path_lower });
        return downloaded.fileBlob.text();
      }
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Dropbox(app, board, descriptor, id),
  createUI: DropboxUI,
};

export default descriptor;
