import { Component } from "react";
import { NativeEventSource, EventSourcePolyfill } from "event-source-polyfill";

import { request } from "../core/actions";
import { isMultipartsResult, parseResponse } from "./MultiformParser";
import { restoreToken } from "../core/Auth";
import { serializeWebsocketBuffer } from "../core/format";
import ServiceUiContainer from "./ServiceUiContainer";
import { createServiceUI } from "../UIFactory";
import {
  AppImpl,
  RuntimeDescriptor,
  ServiceAction,
  ServiceDescriptor,
  ServiceId,
  ServiceImpl,
  ServiceRegistry,
} from "../types";

const EventSource = NativeEventSource || EventSourcePolyfill;

type Command = {
  action: string;
  uuid: string;
  params: any;
  requestId: string | null;
  config: any;
};

type Props = {
  runtime: RuntimeDescriptor;
  userId: string;
  services: Array<ServiceDescriptor>;
  registry: ServiceRegistry;
  boardName: string;

  onArrangeService: (serviceUuid: string, position: number) => void;
  onServiceAction: (command: ServiceAction) => void;
  onResult: (
    uuid: string,
    result: any,
    requestId: string | null
  ) => Promise<void>;

  collapsed?: boolean;
  readonly?: boolean;
};

export default class BrowserRuntime extends Component<Props> {
  serviceInstances: { [uuid: string]: ServiceImpl } = {};
  subservices: {
    [uuid: string]: { service: ServiceImpl; parent: ServiceImpl };
  } = {};
  websocket: WebSocket | null | undefined = null;
  eventSource: EventSource | undefined = undefined;
  app: AppImpl | null | undefined = undefined;

  componentDidMount() {
    const { runtime, userId, services } = this.props;
    if (services) {
      services.forEach((svc) => this.configureService(svc, svc));
    }
    if (runtime && userId && runtime.type !== "browser") {
      this.connect(runtime.id);
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.services !== prevProps.services) {
      this.props.services.forEach((svc) => this.configureService(svc, svc));
    }
  }

  createApp = (): AppImpl | undefined => {
    const { services, registry, boardName, runtime, userId } = this.props;
    if (!services) {
      return;
    }

    return {
      next: this.next,
      getServiceById: this.getServiceById,
      sendAction: (action: ServiceAction) => {
        // the sandbox for example registers a listener
        // for these kind of actions
        const target: any = window.frameElement;
        if (target && target.onAction) {
          target.onAction(action);
        }
      },
      storeServiceData: (serviceUuid: string, key: string, value: string) => {
        localStorage.setItem(serviceDataKey(serviceUuid, key), value);
      },
      restoreServiceData: (serviceUuid: string, key: string) => {
        return (
          localStorage.getItem(serviceDataKey(serviceUuid, key)) || undefined
        );
      },
      removeServiceData: (serviceUuid: string, key: string) => {
        localStorage.removeItem(serviceDataKey(serviceUuid, key));
      },
      notify: (service: ServiceImpl, notification: any) => {
        if (service.__notificationTargets) {
          service.__notificationTargets.notify(service, notification);
        }
      },
      createSubService: (parent: ServiceImpl, service: ServiceDescriptor) => {
        const ssvc = this.createServiceInstance(service);
        if (ssvc) {
          this.subservices[ssvc.uuid] = { service: ssvc, parent };
        }
        return ssvc;
      },
      createSubServiceUI: (svc: ServiceImpl) =>
        createServiceUI(registry, boardName, svc, runtime.id, userId, {
          resizable: false,
        }),
    };
  };

  processRuntime = (params: any, svc: ServiceId | null) =>
    this.next(svc, params, null, false);

  findServiceIndex = (svc: ServiceId) => {
    const { services } = this.props;
    const { parent } = this.subservices[svc.uuid] || {};
    const searchUuid = parent ? parent.uuid : svc.uuid;
    return services.findIndex((s) => s.uuid === searchUuid);
  };

  // service parameter can be null, then starts with the first service
  next = async (
    service: ServiceId | null,
    params: any,
    requestId: string | null = null,
    advanceBeforeProcess: boolean = true
  ) => {
    const { onResult, services } = this.props;
    const position = service === null ? 0 : this.findServiceIndex(service);
    if (position === -1) {
      return console.error(
        "Called next() in browser but could not find current service",
        service,
        services
      );
    }

    let svc = services[position];
    let result = params;
    for (
      let i = advanceBeforeProcess ? position + 1 : position;
      !!services[i] && result !== null;
      ++i
    ) {
      svc = services[i];
      const serviceInstance = this.serviceInstance(svc);
      if (serviceInstance && !serviceInstance.bypass) {
        try {
          result = await serviceInstance.process(params);
          params = result;
        } catch (err) {
          /*console.error(
            `Seriously: service ${JSON.stringify(
              serviceInstance
            )} caused error: `,
            err
          );*/
        }
      }
    }
    const resultReceiver = onResult || this.sendResult;
    await resultReceiver(svc && svc.uuid, result, requestId);
    return result;
  };

  connect(id: string) {
    const { userId, runtime, boardName } = this.props;
    const { name: runtimeName } = runtime;
    const backendPath = `/api/${userId}/${boardName}/${id}`;
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
      restoreToken()
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
    switch (command.action) {
      case "config":
        return this.configureServiceByUuid(command.uuid, command.config);
      case "process":
        return this.processService(
          command.uuid,
          command.params,
          command.requestId
        );
      case "destroy":
        return this.destroyService(command.uuid);
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
    const { userId, runtime, boardName } = this.props;
    const { id: runtimeId } = runtime;

    if (!userId) {
      console.error(
        "Can not send result without valid UserId",
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
        userId,
        serviceUuid,
        requestId,
      });
      this.websocket.send(buffer);
      return null;
    } else {
      // ... or as post
      return request(
        `${userId}/${boardName}/${runtimeId}/${requestId}`,
        "POST",
        false,
        data
      );
    }
  };

  configureServiceByUuid(uuid: string, config: any) {
    const { services } = this.props;
    const service = services.find((s) => (s.uuid = uuid));
    if (!service) {
      return console.error(
        `Could not find browser service to configure: ${uuid} in ${JSON.stringify(
          services
        )}`
      );
    }
    this.configureService(service, config);
  }

  configureService = (service: ServiceDescriptor, config: any) => {
    const svc: ServiceImpl | null = this.serviceInstance(service);
    if (svc) {
      svc.configure(config);
    }
  };

  async processService(uuid: string, params: any, requestId: string | null) {
    const { services } = this.props;
    const position =
      uuid === null ? 0 : services.findIndex((s) => (s.uuid = uuid));
    if (position === -1) {
      return console.error(
        `Could not find browser service to process: ${uuid} in ${JSON.stringify(
          services
        )}`
      );
    }

    // TODO: this is not true since a long time, right?
    // if it's not an object it's a binary buffer base64 encoded
    /*
    const data = typeof params === 'string' ?
      new Blob(
        [decode(params)], 
        { type: 'application/octet-binary' }
      ) :
      params;
      */
    const data = params;

    const service = services[position];
    if (service) {
      return this.next(service, data, requestId, false);
    }
  }

  destroyService(uuid: string) {
    const service = this.getServiceById(uuid);
    if (!service) {
      return console.error(
        `Could not find browser service to process: ${uuid} in ${JSON.stringify(
          this.props.services
        )}`
      );
    }
    return service.destroy && service.destroy();
  }

  getServiceById = (uuid: string) => {
    const { services } = this.props;
    const svc = services.find((s) => s.uuid === uuid);
    return svc ? this.serviceInstance(svc) : null;
  };

  destroyRuntime = async () => {
    const { services = [] } = this.props;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
    if (this.websocket) {
      this.websocket.close();
      this.websocket = undefined;
    }

    for (const ssvcUuid of Object.keys(this.subservices)) {
      const ssvc = this.subservices[ssvcUuid];
      if (ssvc.service.destroy) {
        await ssvc.service.destroy();
      }
    }

    for (const service of services) {
      await this.destroyService(service.uuid);
    }
  };

  createServiceInstance = (
    service: ServiceDescriptor
  ): ServiceImpl | undefined => {
    const { registry, boardName } = this.props;
    const { serviceId, serviceName } = service;
    const descriptor = registry.find((elem) => elem.serviceId === serviceId);
    if (!descriptor) {
      return;
    }

    if (!this.app) {
      this.app = this.createApp();
    }

    const svc = descriptor.create(
      this.app,
      boardName,
      descriptor,
      service.uuid
    );
    if (!svc) {
      console.error("Could not create service", descriptor);
    }
    svc.__descriptor = {
      ...descriptor,
      uuid: service.uuid,
      serviceName: serviceName || descriptor.serviceName,
    };
    const configure = svc.configure.bind(svc);
    svc.configure = (config) => {
      // monkey wire configure
      const { bypass } = config || {};
      if (bypass !== undefined) {
        svc.bypass = bypass;
        this.app?.notify(svc, { bypass });
      }
      return configure && configure(config || {});
    };
    //svc.configure(service); // this happens in componentDidMount/Update hooks
    return svc;
  };

  serviceInstance = (service: ServiceDescriptor): ServiceImpl | null => {
    if (!service) {
      return null;
    }
    const instance = this.serviceInstances[service.uuid];
    if (instance) {
      return instance;
    }

    const svc = this.createServiceInstance(service);
    if (svc) {
      this.serviceInstances[service.uuid] = svc;
      return svc;
    }

    console.error(
      "No browser service descriptor found for ",
      service,
      this.props.registry
    );
    return null; // TODO: old comment: try not to crash
  };

  render() {
    const {
      userId,
      boardName,
      runtime,
      readonly,
      onArrangeService,
      onServiceAction,
      services: rawServices,
      registry,
      collapsed = false,
    } = this.props;
    const services =
      rawServices && rawServices.map((svc) => this.serviceInstance(svc));
    return (
      !collapsed && (
        <ServiceUiContainer
          boardName={boardName}
          runtime={runtime}
          readonly={readonly}
          services={services}
          uiRegistry={registry}
          userId={userId}
          onArrangeService={onArrangeService}
          onServiceAction={onServiceAction}
        />
      )
    );
  }
}

function logInfo(msg: string) {
  // console.log(msg);
}

function serviceDataKey(uuid: string, key: string) {
  return `service-data-${uuid}-${key}`;
}
