import React, { Component } from 'react';
import { 
  Button,
  Checkbox,
} from 'semantic-ui-react';

import ServiceUI from './ServiceUI';
import Dropbox from './Dropbox';
import MessageReceiver from '../../MessageReceiver';
import InputField from '../../components/shared/InputField';
import { s, t } from '../../styles';

const serviceId = 'hookup.to/service/dropbox-sink';
const serviceName = 'Dropbox Sink';

const loginStateId = 'dropbox-sink-login';

class DropboxSinkUI extends Component {
  state = {
    files: [],
    user: undefined,
  };

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
            fontSize: 12 
          }}
          onClick={() => this.onLogin(service)}
        >
          Login
        </Button>
        <MessageReceiver
          state={loginStateId}
          onData={async data => {
            const accessToken = data.access_token;
            this.service.configure({ accessToken });
            const user = await this.service.getUserAccount();
            this.setState({ user });
          }}
        />
      </div>
    ); 
  }

  renderSinkPanel(service) {
    return (
      <div>
        <div
          style={{
            textTransform: 'uppercase', 
            fontSize: 12,
            textAlign: 'left',
            marginBottom: 5,
          }}
        >
          Login: { this.state.user.email }
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
        <div
          style={s(
            { textAlign: 'left' },
            t.uc, t.ls1, t.mt5
          )}
        >
          <Checkbox
            style={t.fs12}
            toggle
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
        {
          this.state.asyncUploadRunning && (
            <div>
              <Button 
                style={s({ width: '100%'} , t.uc, t.ls1, t.fs12, t.mt5)}
                onClick={() => service.finishUpload()}
              >
                Finish
              </Button>
            </div>
          )
        }
        <Button
          style={s({ width: '100%'} , t.mt5,  t.uc, t.ls1, t.fs12)}
          onClick={async () => {
            await service.logout();
            this.setState({ user: null });
          }}
        >
          Logout
        </Button>
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
