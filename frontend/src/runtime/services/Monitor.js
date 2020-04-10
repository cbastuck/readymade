import React, { Component } from 'react';
import { TextArea, Checkbox } from 'semantic-ui-react';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/monitor-browser';
const serviceName = 'Monitor';

class MonitorUI extends Component {
  state ={
    message: ''
  };

  onInit = initialState => {
    this.setState({ ...initialState, message: '' });
  }

  render() {
    return (
      <ServiceUI 
        {...this.props}
        onInit={this.onInit.bind(this)}
      >
        {
          ({ service }) => 
          service && 
          service.register(message => this.setState({ message })) && (
            <div
              style={{
                textAlign: 'left',
                margin: 10,
              }}
            >        
              <TextArea
                style={{ 
                  width: '100%', 
                  minHeight: 150, 
                  minWidth: 200 
                }}
                value={this.state.message}
              />
              <Checkbox
                label="active"
                checked={this.state.enabled}
                onChange={(_, { checked: enabled }) => 
                 this.setState(
                  { enabled }, 
                  () => service.configure({ enabled })
                 )
                }
              />
            </div>
          )
        }
      </ServiceUI>
    );
  }
}

class Monitor {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.enabled = true;
  }

  configure(config) {
    const { enabled } = config;
    if (enabled  !== undefined) {
      this.enabled = enabled;
    }
  }

  process(params) {
    if (this.callback && this.enabled) {
      this.callback(JSON.stringify(params, null, 2));
    }
    return params;
  }

  register(callback) {
    this.callback = callback;
    return true;
  }
}

const descriptor = {  
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Monitor(app, board, descriptor, id),
  createUI: MonitorUI
};

export default descriptor;
