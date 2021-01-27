import React, { Component } from 'react';
import uuid from 'uuid';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/group';
const serviceName = 'Group';

class GroupUI extends Component {
  state = {
    subservices: []
  };

  onInit = initialState => {
    const { subservices } = initialState;
    this.setState({ subservices });
  }

  onNotification = (service, notification) => {  
    const { subservices } = notification;
    if (subservices !== undefined) {
      this.setState({ subservices });
    }  
  }


  renderMain = service => {
    const { subservices=[] } = this.state;
    return (
      <div>
      {
        subservices.map(ssvc => ssvc.__ui)
      }
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
    )
  }
}

class Group {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  destroy() {
  }

  async configure(config) {
    const { services } = config;
    if (services !== undefined) {
      const subservices = []
      for (const svc of services) {
        if (!svc.uuid) {
          svc.uuid = uuid.v4();
        }
        const ssvc = await this.app.createService(svc);
        ssvc.__ui = this.app.createServiceUI(ssvc); // TODO: nice?
        if (ssvc) {
          subservices.push(ssvc);
        }
      }
      this.subservices = subservices;
      this.app.notify({ subservices });
    }
  }

  process(params) {
    if (this.subservices && this.subservices.length > 0) {
      return this.subservices.map(svc => svc.process(params))
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Group(app, board, descriptor, id),
  createUI: GroupUI,
};

export default descriptor;
