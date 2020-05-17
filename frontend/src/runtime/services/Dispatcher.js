import React, { Component } from 'react';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/dispatcher';
const serviceName = 'Dispatcher';

class DispatcherUI extends Component {
    render() {
    return (
      <ServiceUI {...this.props}>
      {
        ({ service }) => (
          service && (
            <div />
          )
        )
      }
      </ServiceUI>
      );
    }
}

class Dispatcher {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }
  
  configure(config) {
  }

  async dispatch(item) {
    if (!item || !item.type || !item.type === 'dispatch') {
      return;
    }
    const service = this.app.getServiceById(item.destination);
    if (service) {
      if (item.config) {
        await service.configure(item.config);
      } 
      if (item.process) {
        return await service.proces(item.params);
      }
    }

  }

  async process(params) {
    if (Array.isArray(params)) {
      await Promise.all(params.map(x => this.dispatch(x)))
    } else {
      await this.dispatch(params);
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Dispatcher(app, board, descriptor, id),
  createUI: DispatcherUI
};

export default descriptor;