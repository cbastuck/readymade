import React, { Component } from "react";

import InputField from "../../../components/shared/InputField";
import ServiceUI from "../../services/ServiceUI";
import { s, t } from "../../../styles";

const serviceId = "hookup.to/service/receiver";
const serviceName = "Receiver";

class ReceiverUI extends Component {
  state = {
    wall: "",
    id: "",
  };

  onInit = (initial) => {};

  onNotification = (notification) => {};

  renderMain = () => {
    const { wall, id } = this.state;
    return (
      <div style={s(t.fill, { display: "flex", flexDirection: "column" })}>
        <InputField
          label="Wall"
          value={wall}
          onChange={(ev, { value: wall }) => this.setState({ wall })}
        />
        <InputField
          label="Id"
          value={id}
          onChange={(ev, { value: id }) => this.setState({ id })}
        />
      </div>
    );
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit}
        onNotification={this.onNotification}
        segments={[{ name: "main", render: this.renderMain }]}
      />
    );
  }
}

class Receiver {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure = (config) => {};

  destroy = () => {};

  process(params) {}
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Receiver(app, board, descriptor, id),
  createUI: ReceiverUI,
};

export default descriptor;
