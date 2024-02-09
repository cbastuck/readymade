import { Component } from "react";
import { NativeEventSource, EventSourcePolyfill } from "event-source-polyfill";

import { request } from "../../core/actions";
import { isMultipartsResult, parseResponse } from "../MultiformParser";
import { serializeWebsocketBuffer } from "../../core/format";
import ServiceUiContainer from "../ServiceUiContainer";

import {
  OnResult,
  RuntimeDescriptor,
  ServiceAction,
  ServiceDescriptor,
  ServiceImpl,
  User,
} from "../../types";
import { createServiceUI } from "../../UIFactory";
import { BoardContextState, BoardCtx } from "../../BoardContext";
import BrowserRuntimeScope from "./BrowserRuntimeScope";
import {
  configureService,
  processService,
  removeService,
} from "./BrowserRuntimeApi";

const EventSource = NativeEventSource || EventSourcePolyfill;

type Command = {
  action: string;
  uuid: string;
  params: any;
  requestId: string | null;
  config: any;
};

type Props = {
  scope: BrowserRuntimeScope;
  runtime: RuntimeDescriptor;
  user: User | null;
  services: Array<ServiceDescriptor>;
  boardName: string;
  collapsed?: boolean;
  readonly?: boolean;

  onArrangeService: (serviceUuid: string, position: number) => void;
  onServiceAction: (command: ServiceAction) => void;
  onResult: OnResult;
};

type State = {
  loadingCounter: number;
};

export default class BrowserRuntime extends Component<Props, State> {
  static contextType = BoardCtx;
  context!: BoardContextState;
  websocket: WebSocket | null | undefined = null;
  eventSource: EventSource | undefined = undefined;

  state = {
    loadingCounter: 0,
  };

  componentWillUnmount() {
    this.destroyRuntime();
  }

  connect(id: string) {
    const { user, runtime, boardName } = this.props;
    const { name: runtimeName } = runtime;
    const backendPath = `/api/${user?.userId}/${boardName}/${id}`;
    logInfo(`Connecting ${runtimeName} to ${backendPath}`);

    const useWebSockets = true;
    if (useWebSockets) {
      // TODO: assume coordinator is on the same host as frontend
      const { host: backendHost, protocol } = window.location;
      const secureConnection = protocol.indexOf("https") === 0;
      this.connectRuntimeViaWebSocket(
        backendHost,
        backendPath,
        secureConnection
      );
    } else {
      this.connectRuntimeViaEventSource(backendPath);
    }
  }

  connectRuntimeViaWebSocket(
    backendHost: string,
    backendPath: string,
    secureConnection: boolean
  ) {
    const { runtime } = this.props;
    const { id: runtimeId, name: runtimeName } = runtime;
    function rebuild(json: any, message: any): object {
      return Object.keys(json).reduce<any>((acc, key) => {
        const value = json[key];
        if (typeof value === "object") {
          return { ...acc, [key]: rebuild(value, message) };
        }
        if (value.startsWith && value.startsWith("+binary-data-@")) {
          const blob = new Blob([message[value].payload], {
            type: message[value].headers["content-type"],
          });
          return { ...acc, [key]: blob };
        } else {
          return { ...acc, [key]: value };
        }
      }, {});
    }

    const protocol = secureConnection ? "wss" : "ws";
    this.websocket = new WebSocket(
      `${protocol}://${backendHost}${backendPath}`,
      this.context.user?.idToken
    );
    this.websocket.binaryType = "arraybuffer";
    this.websocket.onmessage = (event) => {
      const message = parseResponse(event.data);
      const action: Command = isMultipartsResult(message)
        ? rebuild(message.json.payload, message)
        : JSON.parse(message as any); // TODO: not sure how this behaves with Blob
      logInfo(
        `BrowserRuntime ${runtimeId} (${runtimeName}) received: ${JSON.stringify(
          action
        )}`
      );
      this.onMessage(action);
    };
    this.websocket.onclose = (event) => {
      logInfo(`Closed WebSocket with ${runtimeId}`);
    };
    this.websocket.onerror = function (error) {
      console.error(`WebSocket ${runtimeId} Error: `, error);
    };
    this.websocket.onopen = (event) => {
      logInfo(`BrowserRuntime ${runtimeId} WebSocket is open`);
    };
  }

  connectRuntimeViaEventSource(backendPath: string) {
    const { runtime } = this.props;
    const { id: runtimeId } = runtime;
    this.eventSource = new EventSource(backendPath);

    const onMessage = (e: MessageEvent) =>
      this.onMessage(e.data ? JSON.parse(e.data) : e);
    const onError = (error: any) => {
      if (error.status === 504) {
        // HTTP Gateway Timeout
        this.eventSource?.removeEventListener("data", onMessage);
        this.eventSource?.removeEventListener("error", onError);
        this.eventSource = undefined;
        logInfo(`Reconnecting browser runtime ${error} - ${error.status}`);
        setTimeout(() => this.connect(runtimeId), 1000);
        return;
      } else {
        console.error("Unknown error in BrowserRuntime", error);
      }
    };
    this.eventSource?.addEventListener("data", onMessage);
    this.eventSource?.addEventListener("error", onError);
  }

  onMessage(command: Command) {
    const { scope } = this.props;
    switch (command.action) {
      case "config":
        return configureService(scope, { uuid: command.uuid }, command.config);
      case "process":
        return processService(
          scope,
          command,
          command.params,
          command.requestId
        );
      case "destroy":
        return removeService(scope, command);
      case "ping":
        return;
      default:
        console.error("Unknown action in browser runtime: ", command);
    }
  }

  sendResult = async (
    serviceUuid: string,
    data: any,
    requestId: string | null
  ) => {
    const { user, runtime, boardName } = this.props;
    const { id: runtimeId } = runtime;

    if (!user) {
      console.error(
        "Can not send result without valid user",
        runtime,
        boardName
      );
      return;
    }

    if (!runtimeId) {
      return console.error(
        "Could not send result data, no backend is connected"
      );
    }

    if (this.websocket) {
      // send the result via websocket
      const buffer = await serializeWebsocketBuffer(data, {
        board: boardName, // TODO: before was this.board
        userId: user.userId,
        serviceUuid,
        requestId,
      });
      this.websocket.send(buffer);
      return null;
    } else {
      // ... or as post
      return request(
        `${user.userId}/${boardName}/${runtimeId}/${requestId}`,
        "POST",
        false,
        data
      );
    }
  };

  // TODO: remove - but still used in headless and elsewhere
  getServiceById = (uuid: string) => {
    const { services, scope } = this.props;
    const svc = services.find((s) => s.uuid === uuid);
    return svc ? scope.findServiceInstance(svc.uuid) : null;
  };

  destroyRuntime = async () => {
    const { services = [], scope } = this.props;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
    if (this.websocket) {
      this.websocket.close();
      this.websocket = undefined;
    }

    for (const service of services) {
      await removeService(scope, service);
    }
  };

  render() {
    const {
      user,
      boardName,
      readonly,
      runtime,
      scope,
      services: rawServices,
      collapsed = false,
      onResult,
      onArrangeService,
      onServiceAction,
    } = this.props;

    const services = rawServices
      ? (rawServices
          .map((svc) => scope.findServiceInstance(svc.uuid)[0])
          .filter((x) => !!x) as Array<ServiceImpl>)
      : [];

    if (scope && scope.onResult !== onResult) {
      scope.onResult = onResult;
      scope.authenticatedUser = user;
    }

    return (
      !collapsed && (
        <ServiceUiContainer
          boardName={boardName}
          runtime={runtime}
          readonly={readonly}
          services={services}
          userId={user?.userId}
          onArrangeService={onArrangeService}
          onServiceAction={onServiceAction}
          onCreateServiceUi={(
            boardName: string,
            service: ServiceImpl,
            runtimeId: string,
            userId: string | undefined
          ) =>
            scope.registry
              ? createServiceUI(
                  scope.registry,
                  boardName,
                  service,
                  runtimeId,
                  userId
                )
              : null
          }
        />
      )
    );
  }
}

function logInfo(msg: string) {
  // console.log(msg);
}
