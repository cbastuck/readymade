import React, { Component } from 'react';

import WebsocketChannel from './WebsocketChannel';
import ServiceUiContainer from './ServiceUiContainer';

function logInfo(msg) {
  // console.log(msg);
}

export default class RemoteRuntime extends Component {
  componentDidMount() {
    this.remoteRuntimeWebsocket = null;
    this.connect();
  }

  connect = () => {
    const { 
      userId, 
      boardName, 
      runtime 
    } = this.props;
    const backendPath = `/api/${userId}/${boardName}/runtime/${runtime.id}`;
    logInfo(`Connecting ${runtime.name} to ${backendPath}`);

    const { 
      host: backendHost, 
      protocol 
    } = window.location; 
    const url = `${backendHost}${backendPath}`;
    if (this.remoteRuntimeWebsocket) {
      this.remoteRuntimeWebsocket.close();
      this.remoteRuntimeWebsocket = null;
    }
    const secureConnection = protocol.indexOf('https') === 0;
    this.remoteRuntimeWebsocket = new WebsocketChannel(runtime.id, this.onAction, secureConnection);
    return this.remoteRuntimeWebsocket.open(url);
  }

  onAction = action => {
    const { services, runtime } = this.props;
    const { type } = action;
    logInfo(`RemoteRuntime ${runtime.id} (${runtime.name}) received: ${JSON.stringify(action)}` );
    if (type === 'notification') {
      const { serviceUuid, notification } = action;
      const service = services.find(s => s.uuid === serviceUuid);
      if (service && service.__notificationTarget) {
        service.__notificationTarget(service, notification);
      }
    }
  }

  render() {
    const { 
      userId,
      boardName,
      services, 
      runtime, 
      readonly,
      onArrangeService,
      registry
    } = this.props;

    return (
      <ServiceUiContainer 
        userId={userId}
        boardName={boardName}
        runtime={runtime}
        readonly={readonly}
        services={services}
        registry={registry}
        onArrangeService={onArrangeService}
      />
    );
  }
}