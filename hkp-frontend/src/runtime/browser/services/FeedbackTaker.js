import React, { Component } from "react";
import { Checkbox, Input, Label } from "semantic-ui-react";

import ServiceUI from "../../services/ServiceUI";
import { FeedbackProvider } from "./FeedbackProvider";

const serviceId = "hookup.to/service/feedback-taker";
const serviceName = "Feedback Taker";

class FeedbackTakerUI extends Component {
  state = {
    feedbackUnconditional: false,
    feedbackCondition: "",
    channel: "",
  };

  onInit = (initialState) => {
    this.setState({
      feedbackCondition: initialState.feedbackCondition,
      feedbackUnconditional: initialState.feedbackUnconditional,
      channel: initialState.channel || "",
    });
  };

  renderRouting = (service) => {
    return (
      <Input
        style={{
          marginTop: 10,
          marginBottom: 10,
        }}
        label="Channel"
        value={this.state.channel}
        disabled
      />
    );
  };

  renderCondition = (service) => (
    <div style={{ textAlign: "left" }}>
      <div style={{ marginBottom: 10 }}>
        <Label>Unconditional</Label>
        <Checkbox
          toggle
          style={{ marginLeft: 10 }}
          checked={this.state.feedbackUnconditional}
          onChange={(_, { checked: feedbackUnconditional }) =>
            this.setState({ feedbackUnconditional }, () =>
              service.configure({ feedbackUnconditional })
            )
          }
        />
      </div>
      <Input
        label="While"
        disabled={this.state.feedbackUnconditional}
        value={this.state.feedbackCondition}
        onChange={(_, { value: feedbackCondition }) =>
          this.setState({ feedbackCondition })
        }
        onKeyPress={(e) =>
          e.key === "Enter" &&
          service.configure({ feedbackCondition: this.state.feedbackCondition })
        }
      />
    </div>
  );

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit.bind(this)}
        segments={[
          { name: "routing", render: this.renderRouting },
          { name: "condition", render: this.renderCondition },
        ]}
      />
    );
  }
}

class FeedbackTaker {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.feedbackUnconditional = true;
    this.feedbackCondition = undefined;
  }

  configure(config) {
    const { channel, feedbackUnconditional } = config;
    if (channel !== undefined) {
      this.channel = channel;
    }

    if (feedbackUnconditional !== undefined) {
      this.feedbackUnconditional = feedbackUnconditional;
    }
  }

  process(params) {
    if (this.channel && this.feedbackUnconditional) {
      setTimeout(
        () => FeedbackProvider.processFeedback(this.channel, params),
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
    new FeedbackTaker(app, board, descriptor, id),
  createUI: FeedbackTakerUI,
};

export default descriptor;
