import React, { Component } from 'react';

import ServiceUI from '../../runtime/services/ServiceUI';

const serviceId = 'hookup.to/service/example-service';
const serviceName = 'Some Service';

export class ExampleServiceUI extends Component {

  onInit(initialState) {
  }

  renderMain = service => {
    return (
      <div>
        Main
      </div>
    );
  }

  renderSettings = service => {
    return (
      <div>
        Settings
      </div>
    );
  }

  render() {
    return (
      <ServiceUI
        service={{...this.props}}
        onInit={this.onInit.bind(this)}
        segments={[
          { name: 'main', render: this.renderMain },
          { name: 'settings', render: this.renderSettings }
        ]}
      />
    );
  }
}

export class ExampleService {
  constructor() {
    this.uuid = '123.45';
    this.board = 'board';
    this.app = {};

    this.serviceId = serviceId;
    this.serviceName = serviceName;
  }

  configure(config) {
  }

  process(params) {
    return params;
  }
}
