import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';

import ServiceUI from './ServiceUI';
import Dropbox from './Dropbox';
import MessageReceiver from '../../MessageReceiver';

const serviceId = 'hookup.to/service/dropbox-sink';
const serviceName = 'Dropbox Sink';

const loginStateId = 'dropbox-sink-login';

class DropboxSinkUI extends Component {
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

  retrieveUserAccount = async service => {
    const user = await service.getUserAccount();
    if (user) {
      this.setState({ user });
    }
  }

  onInit = service => {
    service.configure({ mode: 'upload' });
    this.service = service;
    this.retrieveUserAccount(service);
  }

  onLogin = async service => {
    const authUrl = service.getAuthUrl(loginStateId);
    window.open(authUrl, 'blank');
  }

  renderLoginPanel(service) {
    return (
      <div>
        <Button 
          style={{ width: '100%' }}
          onClick={() => this.onLogin(service)}
        >
          Login
        </Button>
      </div>
    ); 
  }

  renderFilesPanel(service) {
    return (
      <div>
        User: { this.state.user.email }
      </div>
    );
  }

  renderMain = service => {
    if (!this.state.user) {
      return this.renderLoginPanel(service);     
    }
    return this.renderFilesPanel(service);
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


const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Dropbox(app, board, descriptor, id),
  createUI: DropboxSinkUI,
};

export default descriptor;
