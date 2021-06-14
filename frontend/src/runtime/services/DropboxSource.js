import React, { Component } from 'react';
import { Button, List } from 'semantic-ui-react';

import ServiceUI from './ServiceUI';
import Dropbox from './Dropbox';
import MessageReceiver from '../../MessageReceiver';

const serviceId = 'hookup.to/service/dropbox-source';
const serviceName = 'Dropbox Source';

const loginStateId = 'dropbox-source-login';

class DropboxSourceUI extends Component {
  state = {
    files: [],
    user: undefined,
  };

  retrieveUserAccount = async service => {
    const user = await service.getUserAccount();
    if (user) {
      const files = await service.retrieveFiles();
      this.setState({ user, files });
    }
  }

  onInit = service => {
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
        <MessageReceiver
          state={loginStateId}
          onData={async data => {
            const accessToken = data.access_token;
            this.service.configure({ accessToken });
            this.retrieveUserAccount(this.service);
          }}
        />
      </div>
    ); 
  }

  renderFile(service, file) {
    return (
      <div
        key={`dropbox-file-${file.path_lower}`}
        style={{
            cursor: 'pointer',
            color: '#4183c4',
          }}
        onClick={() => service.trigger({ file })}
      > 
        { file.name }
      </div>
    );
  }

  renderFilesPanel(service) {
    return (
      <div style={{ textAlign: 'left', width: 250 }}>
        User: { this.state.user.email }
        <List>
          
          <List.Item>
            { 
              this.state.files.map(file => this.renderFile(service, file))
            }
          </List.Item>
        </List>
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
  createUI: DropboxSourceUI,
};

export default descriptor;
