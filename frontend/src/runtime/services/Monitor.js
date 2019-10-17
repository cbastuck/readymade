import React, { Component } from 'react';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/monitor-browser';
const serviceName = 'Monitor';

class MonitorUI extends Component {
  state ={
    message: ''
  };

  render() {
    return (
      <ServiceUI {...this.props}>
        {
          ({ service}) => 
          service && 
          service.register(message => this.setState({ message })) && (
            <div
              style={{
                margin: 10,
                width: 200
              }}
            >
              {this.state.message}
            </div>
          )
        }
      </ServiceUI>
    );
  }
}

class Monitor {
  constructor(app, board, descriptor, id) {
    this.id = id;
    this.board = board;
    this.app = app;
  }

  configure() {
    console.log('Configuring Monitor')
  }

  process(params) {
    console.log('Browser monitors incoming ', params);
    if (this.callback) {
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
