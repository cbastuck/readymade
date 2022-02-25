import React, { Component } from "react";
import { Label, Select } from "semantic-ui-react";

import ServiceUI from "./ServiceUI";

const serviceId = "hookup.to/service/feedback-provider";
const serviceName = "Feedback Provider";

class FeedbackProviderUI extends Component {
  state = { options: [] };

  onInit = (initialState) => {
    this.setState({
      options: [
        { text: initialState.listen || "none", key: initialState.uuid },
      ],
    });
  };

  renderMain = (service) => {
    return (
      <div style={{ textAlign: "left" }}>
        <Label size="large">Source Channel</Label>
        <Select
          label="Channels"
          options={this.state.options}
          text={
            this.state.options &&
            this.state.options[0] &&
            this.state.options[0].text
          }
          disabled
        />
      </div>
    );
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit.bind(this)}
        segments={[{ name: "main", render: this.renderMain }]}
      />
    );
  }
}

export class FeedbackProvider {
  // TODO: the following should be per board, not global
  static availableInstances = [];
  static processFeedback(channel, feedbackParams) {
    const listeners = FeedbackProvider.availableInstances.filter(
      (i) => i.listen === channel
    );
    listeners.map((listener) =>
      listener.instance.app.next(listener.instance, feedbackParams)
    );
  }
  static unregisterProvider(provider) {
    FeedbackProvider.availableInstances =
      FeedbackProvider.availableInstances.filter(
        (x) => x.instance !== provider
      );
  }

  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.listen = undefined;
  }

  unregisterProvider() {
    if (this.listen !== undefined) {
      FeedbackProvider.unregisterProvider(this);
      this.listen = undefined;
    }
  }

  configure(config) {
    const { listen } = config;
    if (listen !== undefined) {
      this.unregisterProvider();
      this.listen = listen;
      FeedbackProvider.availableInstances.push({ listen, instance: this });
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
    new FeedbackProvider(app, board, descriptor, id),
  createUI: FeedbackProviderUI,
};

export default descriptor;
