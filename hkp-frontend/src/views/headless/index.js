import React, { Component } from "react";

import Runtime from "../../components/Runtime";
import BrowserRegistry from "../../runtime/BrowserRegistry";

const defaultBundles = [
  "hookup.to/registry/browser/Audio",
  "hookup.to/registry/browser/Graphic",
  "hookup.to/registry/browser/FileStorage",
  "hookup.to/registry/browser/Crypto",
  "hookup.to/registry/browser/Fileformat",
];

export default class Headless extends Component {
  state = {};

  constructor(props) {
    super(props);
    BrowserRegistry.create(defaultBundles).then((defaultRegistry) =>
      this.setState({ defaultRegistry })
    );
  }

  configure = (serviceId, config) => {
    const svc = this.runtime.getServiceById(serviceId);
    return svc.configure(config);
  };

  configuration = (serviceId) => {
    const svc = this.runtime.getServiceById(serviceId);
    return { ...svc };
  };

  processService = (serviceId, params) => {
    const svc = this.runtime.getServiceById(serviceId);
    return svc.process(params);
  };

  process = (params, serviceId) =>
    this.runtime.processRuntime(params, serviceId);

  onResult = (runtimeId, data) => {
    const { callback } = this.props;
    if (callback) {
      callback(data);
    } else {
      console.log("No callback set, printing result from:", runtimeId, data);
    }
  };

  renderRuntime(boardContext, runtime) {
    const { expanded = false } = this.props;
    return (
      <Runtime
        ref={(rt) => (this.runtime = rt)}
        boardContext={boardContext}
        runtime={runtime}
        onResult={this.onResult}
        expanded={expanded}
        headless={!expanded}
      />
    );
  }

  render() {
    const { runtimeId, runtimeName, services } = this.props;
    const { defaultRegistry } = this.state;
    if (!defaultRegistry) {
      return false;
    }

    const runtime = { id: runtimeId, name: runtimeName };
    const boardContext = {
      board: { name: "headless-board" },
      runtimes: [runtimeId],
      services: {
        [runtimeId]: services,
      },
      registry: {
        [runtimeId]: defaultRegistry.availableServices,
      },
      isRuntimeInScope: () => true,
    };
    return this.renderRuntime(boardContext, runtime);
  }
}

Headless.defaultProps = {
  runtimeId: "d5a48a72-b077-4d1e-83de-4be8f64bc3e8",
  runtimeName: "Headless runtime",
  services: [
    {
      serviceId: "hookup.to/service/timer",
      serviceName: "Timer",
      uuid: "fb58b71d-dccd-4bfe-afac-5d52b9bc1a9e",
      running: true,
      periodic: true,
      periodicValue: 1,
      periodicUnit: "s",
    },
  ],
};
