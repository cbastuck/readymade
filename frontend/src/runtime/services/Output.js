import React, { Component } from 'react';
import { 
  Checkbox,
} from 'semantic-ui-react';

import ServiceUI from './ServiceUI';
import { s, t } from '../../styles';
import InputField from '../../components/shared/InputField';
import { request } from '../../core/actions';

const serviceId = 'hookup.to/service/output';
const serviceName = 'Output';

class OutputUI extends Component {
  state = {
    URL: '',
  };

  onInit = initialState => {
    const { URL='', running=false } = initialState;
    this.setState({ URL, running });
  }

  onNotification = (service, notification) => {
    const { 
      URL, 
      running 
    } = notification;
    
    if (URL !== undefined && this.state.URL !== URL) {
      this.setState({ URL });
    }

    if (running !== undefined && this.state.running !== running) {
      this.setState({ running });
    }
  }

  renderMain = service => {
    const { 
      running,
      URL,
    } = this.state;
    return (
      <div style={t.m10}>
        <div style={s(t.uc, t.ls1, t.fs12)}> 
          <InputField 
            label="URL"
            value={URL}
            onChange={(_, { value }) => {
              this.setState({ URL: value });
              service.configure({ URL: value });
            }}
          />
        </div>
        <div style={s(t.tl, t.mt5)}>
          <Checkbox 
            style={s(t.mt5, t.uc, t.ls1, t.fs12)}
            label="active"
            toggle
            onChange={(_, { checked }) => {
              if (checked) {
                service.configure({ running: true });
              } else {
                service.configure({ running: false });
              }
            }}
            checked={running}
          />
        </div>
      </div>
    );
  }

  render() {
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit}
        onNotification={this.onNotification}
        segments={[
          { name: 'Main', render: this.renderMain },
        ]}
      />
    );
  }
}

class Output {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.running = false;
    this.URL = '';
  }

  configure(config) {
    const { 
      URL,
      running,
    } = config;

    if (running !== undefined) {
      this.running = running;
      this.app.notify(this, { running });
    }

    if (URL !== undefined) {
      this.URL = URL;
      this.app.notify(this, { URL });
    }
  }

  destroy() {
    
  }

  process(params) {
    const { URL, running } = this;
    if (URL && running) {
      const topic = 'secret-key';
      request({ absolute: URL }, 'POST', false, params, { 'hkp-runtime-topic': topic });
    }

    // TODO support for different modes, stop propagation for now
    return null; 
  }
}

const descriptor = {  
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Output(app, board, descriptor, id),
  createUI: OutputUI
};

export default descriptor;
