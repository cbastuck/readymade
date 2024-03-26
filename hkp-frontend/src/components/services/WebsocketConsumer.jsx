import React, { Component } from "react";
import { TextArea } from "semantic-ui-react";

import { getServiceConfiguration } from "../../core/actions";

export default class WebsocketConsumer extends Component {
  constructor(props) {
    super(props);

    this.state = {
      value: "",
    };
    this.connectWebsocket();
  }

  connectWebsocket = async () => {
    const { board, service } = this.props;
    const { port } = await getServiceConfiguration(board, service);
    if (!port) {
      console.log("Reconnecting, as no port is available ...");
      return setTimeout(this.connectWebsocket, 1000);
    }
    this.socket = new WebSocket(`ws://localhost:${port}`);
    if (this.socket) {
      this.socket.onopen = (event) => {
        console.log(
          "Here's some text that the server is urgently awaiting!",
          event
        );
      };
      this.socket.onmessage = (event) => {
        this.setState({ value: event.data });
        console.log(event.data);
      };
    }
  };

  render() {
    const lineStyle = {
      textAlign: "left",
      marginBottom: 10,
      padding: 10,
    };

    return (
      <div>
        <div style={lineStyle}>
          <TextArea value={this.state.value} />
        </div>
      </div>
    );
  }
}
