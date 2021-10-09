import React, { Component } from "react";

// import ServiceUI from './ServiceUI';

const serviceId = "hookup.to/service/switch";
const serviceName = "Switch";

class SwitchUI extends Component {
  render() {
    return <div />;
  }
}

class Switch {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {}

  process(params) {
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Switch(app, board, descriptor, id),
  createUI: SwitchUI,
};

export default descriptor;
