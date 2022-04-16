import React, { Component } from "react";

import WebsocketChannel from "./WebsocketChannel";
import { serializeWebsocketBuffer } from "../core/format";
import { restoreToken } from "../core/Auth";
import ServiceUiContainer from "./ServiceUiContainer";
import defaultRegistry from "./registry/Default";

function logInfo(msg) {
  // console.log(msg);
}

export default class RemoteRuntime extends Component {
  componentDidMount() {
    this.remoteRuntimeWebsocket = null;
    this.connect();
  }

  connect = () => {
    const { userId, boardName, runtime } = this.props;
    const backendPath = `${userId}/${boardName}/runtime/${runtime.id}`;

    const [runtimeUrlProto, runtimeUrlWithoutProto] = runtime.url
      ? runtime.url.split("://")
      : [];
    const { host: backendHost, protocol } = window.location;
    const urlWithoutProtocol = runtime.url
      ? `${runtimeUrlWithoutProto}/${backendPath}`
      : `${backendHost}/api/${backendPath}`;

    logInfo(`Connecting ${runtime.name} to ${urlWithoutProtocol}`);

    if (this.remoteRuntimeWebsocket) {
      this.remoteRuntimeWebsocket.close();
      this.remoteRuntimeWebsocket = null;
    }
    const secureConnection =
      (runtimeUrlProto || protocol).indexOf("https") === 0;
    this.remoteRuntimeWebsocket = new WebsocketChannel(
      runtime.id,
      this.onAction,
      secureConnection
    );
    return this.remoteRuntimeWebsocket.open(urlWithoutProtocol, restoreToken());
  };

  processRuntime = async (params) => {
    const buffer = await serializeWebsocketBuffer(params, {
      board: this.board,
      runtimeId: this.props.runtime.id,
    });
    this.remoteRuntimeWebsocket.send(buffer, true);
  };

  onAction = (action) => {
    const { services, runtime } = this.props;
    const { type } = action;
    logInfo(
      `RemoteRuntime ${runtime.id} (${runtime.name}) received: ${JSON.stringify(
        action
      )}`
    );
    if (type === "notification") {
      const { serviceUuid, notification } = action;
      const service = services.find((s) => s.uuid === serviceUuid);
      if (service && service.__notificationTargets) {
        service.__notificationTargets.notify(service, notification);
      }
    }
  };

  render() {
    const {
      userId,
      boardName,
      services,
      runtime,
      readonly,
      onArrangeService,
      onServiceAction,
      registry,
    } = this.props;

    const uiRegistry = registry.map(
      (r) => defaultRegistry.find((dr) => r.serviceId === dr.serviceId) || r
    );
    return (
      <ServiceUiContainer
        userId={userId}
        boardName={boardName}
        runtime={runtime}
        readonly={readonly}
        services={services}
        uiRegistry={uiRegistry}
        onArrangeService={onArrangeService}
        onServiceAction={onServiceAction}
      />
    );
  }
}
