import React, { Component } from "react";

import ServiceUI from "../../services/ServiceUI";

const serviceId = "hookup.to/service/dispatcher";
const serviceName = "Dispatcher";

class DispatcherUI extends Component {
  render() {
    return (
      <ServiceUI {...this.props}>
        {({ service }) => service && <div />}
      </ServiceUI>
    );
  }
}

class Dispatcher {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {}

  async dispatch(item) {
    const { type, destinations } = item || {};
    if (!item || type !== "dispatch" || !destinations) {
      return;
    }

    for (const dest of destinations) {
      const { config, process, serviceUuid } = dest;
      const service = this.app.getServiceById(serviceUuid);
      if (service) {
        if (config) {
          await service.configure(config);
        }
        if (process) {
          return await service.process(process);
        }
      }
    }
  }

  async process(params) {
    if (Array.isArray(params)) {
      await Promise.all(params.map((x) => this.dispatch(x)));
    } else {
      await this.dispatch(params);
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Dispatcher(app, board, descriptor, id),
  createUI: DispatcherUI,
};

export default descriptor;
