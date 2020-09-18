import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/trigger';
const serviceName = 'Trigger';

class TriggerUI extends Component {
  state = {
    files: [],
    user: undefined,
  };


  onInit = service => {
    this.service = service;
  }

  renderMain = service => {
    return (
      <div>
        <Button
          onClick={() => service.trigger() }
        >
          Trigger
        </Button>
      </div>
    );
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

class Trigger {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.output = {};
  }

  configure(config) {
    const { output } = config;
    if (output !== undefined) {
      this.output = output;
    }
  }

  getOutput(params={}) {
    return {
      ...this.output,
      ...params
    };
  }

  trigger() {
     this.app.next(this, this.getOutput({}));
  }

  async process(params) {
    return this.getOutput(params);
  }
}


const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Trigger(app, board, descriptor, id),
  createUI: TriggerUI,
};

export default descriptor;
