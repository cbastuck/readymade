import {
  AppImpl,
  RemoteRuntimeMessageType,
  RuntimeDescriptor,
  RuntimeScope,
  User,
} from "../../types";
import { createRemoteRuntimeApp } from "./RemoteRuntimeApp";

export default class RemoteRuntimeScope implements RuntimeScope {
  app: AppImpl;
  descriptor: RuntimeDescriptor; // TODO: better keep the whole runtime descriptor - change API
  outputUrl: string;
  socket: WebSocket | null;
  pendingReconnectPromise: [() => void, () => void] | null; // resolve/reject callbacks
  authenticatedUser: User | null = null;
  pingTimer: NodeJS.Timeout | undefined;

  constructor(runtime: RuntimeDescriptor, outputUrl: string) {
    this.app = createRemoteRuntimeApp(this);
    this.descriptor = runtime;
    this.outputUrl = outputUrl;
    this.socket = null;
    this.pendingReconnectPromise = null;

    if (this.outputUrl) {
      this.connect(this.outputUrl);
    }
  }

  getApp = (): AppImpl => {
    return this.app;
  };

  onResult = async (
    instanceId: string | null,
    result: any,
    requestId: string | null
  ): Promise<void> => {
    console.warn("RemoteRuntimeScope.onResult not set");
  };

  onConfig = (instanceId: string, config: object) => {
    console.warn("RemoteRuntimeScope.onConfig not set");
  };

  connect = (outputUrl: string) => {
    const url = new URL(this.descriptor.url!);
    url.protocol = new URL(url).protocol === "http:" ? "ws" : "wss";
    const websocketUrl = url.toString() + outputUrl.slice(1);
    const socket = new WebSocket(websocketUrl);
    this.socket = socket;

    socket.onopen = this.onSocketOpened;
    socket.onmessage = this.onMessage;
    socket.onclose = this.onSocketClosed;
    socket.onerror = this.onSocketError;
  };

  isConnected = () => {
    return !!this.socket;
  };

  reconnect = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (this.socket || !this.outputUrl) {
        console.warn(
          "RuntimeRemoteScope can not reconnect if socket available or output url missing"
        );
        return reject();
      }
      this.pendingReconnectPromise = [resolve, reject];
      this.connect(this.outputUrl);
    });
  };

  onSocketError = (event: Event) => {
    if (this.pendingReconnectPromise) {
      this.pendingReconnectPromise[1](); // reject the reconnect - TODO: might be a non-fatal error
      this.pendingReconnectPromise = null;
    }
  };

  onSocketOpened = (event: Event) => {
    if (this.socket) {
      this.pingTimer = setInterval(
        () =>
          this.socket &&
          this.socket.send(
            JSON.stringify({
              type: "ping",
            })
          ),
        10000
      );
    }
    if (this.pendingReconnectPromise) {
      this.pendingReconnectPromise[0]();
      this.pendingReconnectPromise = null;
    }
  };

  onSocketClosed = () => {
    if (this.socket) {
      this.socket = null;
      if (this.pingTimer) {
        // TODO: this timer is not cleared when scope is destroyed
        clearInterval(this.pingTimer);
        this.pingTimer = undefined;
      }
    }
  };

  onMessage = (event: MessageEvent) => {
    let message;
    try {
      // TODO: binary data is currently not supported with this logic
      message = JSON.parse(event.data);
    } catch (err) {
      console.error("Received invalid message", event.data);
      return;
    }

    if (message.type === RemoteRuntimeMessageType.PONG) {
      // console.log("Received a pong message");
    } else if (message.type === RemoteRuntimeMessageType.RESULT) {
      this.onResult(null, message.data, null);
    } else if (message.type === RemoteRuntimeMessageType.CONFIGURATION) {
      this.onConfig(message.data.instanceId, message.data.config);
    } else {
      console.warn(
        `Unknown message reived in remote runtime scope: ${JSON.stringify(
          event.data
        )}`
      );
    }
  };

  reportBoardResult = (result: any) => {
    if (this.socket) {
      this.socket.send(
        JSON.stringify({
          type: "boardResult",
          result: JSON.stringify(result),
        })
      );
    }
  };
}
