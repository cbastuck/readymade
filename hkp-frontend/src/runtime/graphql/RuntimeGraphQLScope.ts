import {
  AppImpl,
  ProcessContext,
  RemoteRuntimeMessageType,
  RuntimeApi,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceAction,
  User,
} from "../../types";
import { createRuntimeGraphQLApp } from "./RuntimeGraphQLApp";
import api from "./RuntimeGraphQLApi";
import { createAuthorizedURL } from "hkp-frontend/src/views/playground/common";

export default class RuntimeGraphQLScope implements RuntimeScope {
  app: AppImpl;
  descriptor: RuntimeDescriptor;
  outputUrl: string;
  socket: WebSocket | null;
  pendingReconnectPromise: [() => void, () => void] | null; // resolve/reject callbacks
  authenticatedUser: User | null = null;
  pingTimer: NodeJS.Timeout | undefined;
  processContexts: { [requestId: string]: ProcessContext } = {};

  constructor(runtime: RuntimeDescriptor, outputUrl: string) {
    this.app = createRuntimeGraphQLApp(this);
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
    _context?: ProcessContext | null,
  ): Promise<void> => {
    console.warn("RuntimeGraphQLScope.onResult not set");
  };

  onAction = (_action: ServiceAction): boolean => {
    console.warn("RuntimeGraphQLScope.onAction not implemented");
    return false;
  };

  // some remove services like ingress can start processing their runtime
  // but need the result of the surrounding board
  processBoardFromRuntime = async (data: any, requestId: string) => {
    const context = {
      requestId,
    };
    const boardResult = await new Promise<any>((onResolve) =>
      this.onResult(null, data, { ...context, onResolve }),
    );
    if (this.socket) {
      this.socket.send(
        JSON.stringify({
          type: "boardResult",
          result: JSON.stringify(boardResult),
          requestId: context.requestId,
        }),
      );
    }
  };

  onConfig = (_instanceId: string, _config: object) => {
    console.warn("RuntimeGraphQLScope.onConfig not set");
  };

  connect = (outputUrl: string, user: User | null) => {
    if (user) {
      this.authenticatedUser = user;
    }

    const url = new URL(this.descriptor.url!);
    url.protocol = new URL(url).protocol === "http:" ? "ws" : "wss";
    const websocketUrl = createAuthorizedURL(
      url.toString() + outputUrl.slice(1),
      this.authenticatedUser,
    );
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
          "RuntimeRemoteScope can not reconnect if socket available or output url missing",
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
            }),
          ),
        10000,
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
      console.error("Received invalid message", err, event.data);
      return;
    }

    if (message.type === RemoteRuntimeMessageType.PONG) {
      // console.log("Received a pong message");
    } else if (message.type === RemoteRuntimeMessageType.RESULT) {
      this.onResult(
        null,
        message.data,
        this.consumeProcessContext(message.requestId), // consumer the context if one exists
      );
    } else if (
      message.type === RemoteRuntimeMessageType.PROCESS_BOARD_FROM_RT
    ) {
      // This actually is the case when a remote service (eg. ingress) starts processing its runtime, which could have more runtimes on that board
      // Since this Webapp is the board owner the remote runtime does not know about other runtimes
      this.processBoardFromRuntime(message.data, message.requestId);
    } else if (message.type === RemoteRuntimeMessageType.CONFIGURATION) {
      this.onConfig(message.data.instanceId, message.data.config);
    } else if (message.type === RemoteRuntimeMessageType.NOTIFICATION) {
      const { instanceId, data, mimeType } = message;
      if (mimeType !== "application/json") {
        throw new Error(
          "Remote runtime notifications can only be JSON at the moment",
        );
      }
      const svc = this.app.getServiceById(instanceId);
      if (svc) {
        this.app.notify(svc, data);
      }
    } else {
      console.warn(
        `Unknown message reived in remote runtime scope: ${JSON.stringify(
          event.data,
        )}`,
      );
    }
  };

  registerProcessContext = (context: ProcessContext) => {
    if (this.processContexts[context.requestId]) {
      console.warn(
        `RuntimeGraphQLScope.registerProcessContext: context with requestId ${context.requestId} already registered and not yet consumed`,
      );
    }
    this.processContexts[context.requestId] = context;
  };

  consumeProcessContext = (requestId: string): ProcessContext | null => {
    const ctx = this.processContexts[requestId] || null;
    if (ctx) {
      this._unregisterProcessContext(ctx);
    }
    return ctx || null;
  };

  // should only called by consumeProcessContext (?)
  _unregisterProcessContext = (context: ProcessContext) => {
    delete this.processContexts[context.requestId];
  };
}
