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
    accessToken: undefined,
    files: [],
  };

  componentDidMount() {
    MessageReceiver.registerRedirect(
      loginStateId,
      async data => {
        const files = await this.retrieveFiles(data.access_token);
        this.setState({ accessToken: data.access_token, files });
      }
    );
  }

  onInit = initialState => {
    this.setState({ ...initialState });
  }

  retrieveFiles = async accessToken => {
    const dbx = new DBox({
      fetch, 
      accessToken
    });
    const response = await dbx.filesListFolder({ path: '' });
    return response.entries;
  }

  onLogin = async () => {
    const dbx = new DBox({
      clientId,
      fetch
    });
    const authUrl = dbx.getAuthenticationUrl(redirectURI, loginStateId);
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
        { JSON.stringify(this.state.files) }
      </div>
    );
  }

  renderMain = () => {
    if (!this.state.accessToken) {
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
  }

  configure(config) {
  }

  process(params) {
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
