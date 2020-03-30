import React, { Component } from 'react';
import {
  Checkbox,
  Input,
} from 'semantic-ui-react';

import ServiceUI from './ServiceUI';
import { FeedbackSource } from './FeedbackSource';

const serviceId = 'hookup.to/service/feedback-sink';
const serviceName = 'Feedback Sink';

class FeedbackSinkUI extends Component {
  state = {
    feedbackEnabled: false,
  };

  onInit = initialState => {
    this.setState({
      feedbackEnabled: initialState.feedbackEnabled,
      source: initialState.source,
    });
  }

  renderMain = service => {
    return (
      <div style={{ textAlign: 'left' }}>
        <Input
          style={{
            marginBottom: 10,
          }}
          label="Source"
          value={this.state.source || ''}
          disabled
        />
        <Checkbox
          toggle
          label="Feedback enabled"
          checked={this.state.feedbackEnabled}
          onChange={(_, { checked: feedbackEnabled }) => 
            this.setState(
              { feedbackEnabled }, 
              () => service.configure({ feedbackEnabled })
            )
          }
        />
      </div>
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

class FeedbackSink {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.feedbackEnabled = true;
  }

  configure(config) {
    const { source, feedbackEnabled } = config;
    if (source !== undefined) {
      this.source = source;
    }

    if (feedbackEnabled !== undefined) {
      this.feedbackEnabled = feedbackEnabled;
    }
  }

  process(params) {
    if (this.source && this.feedbackEnabled) {
      setTimeout(
        () => FeedbackSource.processFeedback(this.source, params), 
        0
      );
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new FeedbackSink(app, board, descriptor, id),
  createUI: FeedbackSinkUI
};

export default descriptor;

