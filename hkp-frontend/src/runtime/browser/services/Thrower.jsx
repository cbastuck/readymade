import React, { Component } from "react";

import InputField from "../../../components/shared/InputField";
import ServiceUI from "../../services/ServiceUI";
import { s, t } from "../../../styles";

const serviceId = "hookup.to/service/thrower";
const serviceName = "Thrower";

class ThrowerUI extends Component {
  state = {
    pushUrl: "",
    id: "",
  };

  onInit = (initial) => {
    const { pushUrl = "" } = initial;
    this.setState({
      pushUrl,
    });
  };

  onNotification = (notification) => {
    const { pushUrl } = notification;
    if (pushUrl !== undefined) {
      this.setState({ pushUrl });
    }
  };

  renderMain = (service) => {
    const { pushUrl, id } = this.state;
    return (
      <div style={s(t.fill, { display: "flex", flexDirection: "column" })}>
        <InputField
          label="URL"
          value={pushUrl}
          onChange={async (ev, { value: pushUrl }) => {
            await service.configure({ pushUrl });
            this.setState({ pushUrl });
          }}
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

class Thrower {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.pushUrl = "";
  }

  configure = async (config) => {
    const { pushUrl } = config;
    if (pushUrl !== undefined) {
      this.pushUrl = pushUrl;
    }
  };

  destroy = () => {};

  async process(params) {
    if (this.pushUrl) {
      // TODO: probably this should be runtime functionality
      // because this way, without encoding the params,
      // it only works for text content
      await fetch(this.pushUrl, {
        method: "POST",
        body: JSON.stringify(params),
      });
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Thrower(app, board, descriptor, id),
  createUI: ThrowerUI,
};

export default descriptor;
