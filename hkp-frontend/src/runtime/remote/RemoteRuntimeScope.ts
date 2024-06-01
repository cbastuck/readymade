import {
  AppImpl,
  RemoteRuntimeMessageType,
  RuntimeApi,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceAction,
  User,
} from "../../types";
import { createRemoteRuntimeApp } from "./RemoteRuntimeApp";
import api from "./RemoteRuntimeApi";

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
      this.connect(this.outputUrl, runtime.user || null);
    }
  }

  getApi(): RuntimeApi {
    return api;
  }

  getApp = (): AppImpl => {
    return this.app;
  };

  onResult = async (
    _instanceId: string | null,
    _result: any,
    _requestId: string | null,
    _resultCallback: null | ((p: any) => void)
  ): Promise<void> => {
    console.warn("RemoteRuntimeScope.onResult not set");
  };

  onAction = (_action: ServiceAction): boolean => {
    console.warn("RemoteRuntimeScope.onAction not implemented");
    return false;
  };

  onResultWithCallback = async (data: any) => {
    const boardResult = await new Promise<any>((resolve) =>
      this.onResult(null, data, null, resolve)
    );
    this.reportBoardResult(boardResult);
  };

  onConfig = (_instanceId: string, _config: object) => {
    console.warn("RemoteRuntimeScope.onConfig not set");
  };

  connect = (outputUrl: string, user: User | null) => {
    if (user) {
      this.authenticatedUser = user;
    }

    const url = new URL(this.descriptor.url!);
    url.protocol = new URL(url).protocol === "http:" ? "ws" : "wss";
    const websocketUrl =
      url.toString() +
      outputUrl.slice(1) +
      `?token=${this.authenticatedUser?.idToken}`;
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
      console.log("Calling Reconnect");
      if (this.socket || !this.outputUrl) {
        console.warn(
          "RuntimeRemoteScope can not reconnect if socket available or output url missing"
        );
        return reject();
      }
      this.pendingReconnectPromise = [resolve, reject];

      this.connect(this.outputUrl, this.authenticatedUser);
    });
  };

  onSocketError = (_event: Event) => {
    if (this.pendingReconnectPromise) {
      this.pendingReconnectPromise[1](); // reject the reconnect - TODO: might be a non-fatal error
      this.pendingReconnectPromise = null;
    }
  };

  onSocketOpened = (_event: Event) => {
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
      if (message.expectCallback) {
        this.onResultWithCallback(message.data);
      } else {
        this.onResult(null, message.data, null, null);
      }
    } else if (message.type === RemoteRuntimeMessageType.CONFIGURATION) {
      this.onConfig(message.data.instanceId, message.data.config);
    } else if (message.type === RemoteRuntimeMessageType.NOTIFICATION) {
      const { instanceId, data, mimeType } = message;
      if (mimeType !== "application/json") {
        throw new Error(
          "Remote runtime notifications can only be JSON at the moment"
        );
      }
      const svc = this.app.getServiceById(instanceId);
      if (svc) {
        this.app.notify(svc, data);
      }
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
