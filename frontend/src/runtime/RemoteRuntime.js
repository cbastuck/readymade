import WebsocketChannel from './WebsocketChannel';

export default class RemoteRuntime {
  constructor(user, board, rt, getServices) {
    for (const key in rt) {
      this[key] = rt[key];
    }
    this.remoteRuntimeBoard = board
    this.remoteRuntimeUser = user;
    this.remoteRuntimeWebsocket = null;
    this.getServices = getServices;
  }

  connect() {
    const backendPath = `/api/${this.remoteRuntimeUser.userId}/${this.remoteRuntimeBoard}/runtime/${this.id}`;
    console.log(`Connecting ${this.name} to ${backendPath}`);

    const backendHost = window.location.host; 
    const url = `${backendHost}${backendPath}`;
    if (this.remoteRuntimeWebsocket) {
      this.remoteRuntimeWebsocket.close();
      this.remoteRuntimeWebsocket = null;
    }
    this.remoteRuntimeWebsocket = new WebsocketChannel(this.id, this.onAction);
    return this.remoteRuntimeWebsocket.open(url);
  }

  onAction = action => {
    const { type }  = action;
    if (type === 'notification') {
      const { serviceUuid, notification } = action;
      const service = this.getServices().find(s => s.uuid = serviceUuid);
      if (service.__notificationTarget) {
        service.__notificationTarget(service, notification);
      }
    }
  }
}