import React, { Component } from "react";

import { Checkbox } from "semantic-ui-react";

import { s, t } from "../../styles";
import Copyable from "../Copyable";
import ServiceUI from "../../runtime/services/ServiceUI";

export default class WebsocketUI extends Component {
  state = {
    url: "",
  };

  onInit = (initial) => {
    const { url = "", isPublic = false } = initial;
    this.setState({ url, isPublic });
  };

  onNotification = (notification) => {
    const { isPublic } = notification;
    if (isPublic !== undefined) {
      this.setState({ isPublic });
    }
  };

  renderMain = (service) => {
    const { url, isPublic } = this.state;
    const { protocol, host } = window.location;
    const wsProtocol = protocol.indexOf("https") === 0 ? "wss" : "ws";
    const full = `${wsProtocol}://${host}${url}`;
    return (
      <div style={{ textAlign: "left" }}>
        <Checkbox
          toggle
          label="Public"
          style={s(t.fs12, t.m(0, 3))}
          onChange={async (_, { checked: isPublic }) => {
            this.setState({ isPublic }, () => service.configure({ isPublic }));
          }}
          checked={isPublic}
        />
        {url && <Copyable label="URL" value={full} />}
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
