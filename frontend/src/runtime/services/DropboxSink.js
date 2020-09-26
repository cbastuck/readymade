import React, { Component } from 'react';
import { 
  Button,
  Checkbox,
} from 'semantic-ui-react';

import ServiceUI from './ServiceUI';
import Dropbox from './Dropbox';
import MessageReceiver from '../../MessageReceiver';
import InputField from '../../components/shared/InputField';

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
    this.setState({ 
      uploadFilename: service.uploadFilename,
      active: service.uploadActive,
    });
  }

  onTimer = service => {
    this.setState({ asyncUploadRunning: !!service.uploadSession })
  }

  onLogin = async service => {
    const authUrl = service.getAuthUrl(loginStateId);
    window.open(authUrl, 'blank');
  }

  renderLoginPanel(service) {
    return (
      <div>
        <Button 
          style={{ 
            width: '100%', 
            textTransform: 'uppercase', 
            fontSize: 11 
          }}
          onClick={() => this.onLogin(service)}
        >
          Login
        </Button>
      </div>
    ); 
  }

  renderSinkPanel(service) {
    return (
      <div>
        <div
          style={{
            margin: '10px 0px',
            textTransform: 'uppercase', 
            fontSize: 12,
            textAlign: 'left',
          }}
        >
          User: { this.state.user.email }
        </div>
        <div
          style={{
            textAlign: 'left'
          }}
        >
          <Checkbox
            label="Upload Incoming"
            checked={this.state.active}
            onChange={(_, {checked}) => 
              this.setState(
                { active: checked }, 
                () => service.uploadActive = checked
              )
            }
          />
        </div>
        <InputField
          label="filename"
          value={this.state.uploadFilename}
          disabled={!this.state.active}
          onChange={(_, { value }) => {
            service.configure({ uploadFilename: value });
            this.setState({ uploadFilename: value });
          }}
        />
        <div>
          <Button 
            style={{ width: '100%' }}
            onClick={() => service.finishUpload()}
            disabled={!this.state.asyncUploadRunning}
          >
            Finish
          </Button>
        </div>
      </div>
    );
  }

  renderMain = service => {
    if (!this.state.user) {
      return this.renderLoginPanel(service);     
    }
    return this.renderSinkPanel(service);
  }

  render() {
    return (
      <ServiceUI
        {...this.props} 
        onInit={this.onInit.bind(this)}
        onTimer={this.onTimer.bind(this)}
        segments={[
          { name: 'Main', render: this.renderMain },
        ]}
      />
    );
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
