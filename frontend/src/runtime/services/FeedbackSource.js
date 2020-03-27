import React, { Component } from 'react';
import { 
  Input,
} from 'semantic-ui-react';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/feedback-source';
const serviceName = 'Feedback Source';

class FeedbackSourceUI extends Component {
  state = {};

  onInit = initialState => {
    this.setState(initialState);
  }

  renderMain = service => {
    return (
      <Input
        label="Name"
        value={this.state.name || ''}
        disabled
      />        
    );
  }

  render() {
    return (
      <ServiceUI
        {...this.props} 
        onInit={this.onInit.bind(this)}
        segments={[
          { name: 'main', render: this.renderMain },
        ]}
      />
    );
  }
}

export class FeedbackSource {
  static availableInstances = [];
  static processFeedback(instanceName, feedbackParams) {
    const { instance } = FeedbackSource.availableInstances.find(i => i.name === instanceName) || {};
    if (instance) {
      instance.app.next(instance, feedbackParams);
    }
  }

  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {
    const { name } = config;
    if (name !== undefined) {
      this.name = name;
      FeedbackSource.availableInstances.push({ name, instance: this });
    }
  }

  process(params) {
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new FeedbackSource(app, board, descriptor, id),
  createUI: FeedbackSourceUI
};

export default descriptor;

