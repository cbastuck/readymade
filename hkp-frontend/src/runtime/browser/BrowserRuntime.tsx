import React, { Component, ReactElement } from "react";

import ServiceUiContainer from "../ServiceUiContainer";

import {
  OnResult,
  ProcessRuntimeByName,
  RuntimeDescriptor,
  ServiceAction,
  ServiceDescriptor,
  ServiceInstance,
  User,
} from "../../types";
import { findServiceUI } from "../../UIFactory";
import { BoardCtx } from "../../BoardContext";
import BrowserRuntimeScope from "./BrowserRuntimeScope";
import { removeRuntime } from "./BrowserRuntimeApi";
import PlaceholderUI from "./services/PlaceholderUI";
import EmptyRuntimePlaceholder from "hkp-frontend/src/ui-components/runtime-ui/EmptyRuntimePlaceholder";

type Props = {
  scope: BrowserRuntimeScope;
  runtime: RuntimeDescriptor;
  user: User | null;
  services: Array<ServiceDescriptor>;
  boardName: string;
  collapsed?: boolean;
  className?: string;

  onArrangeService: (serviceUuid: string, position: number) => void;
  onServiceAction: (command: ServiceAction) => void;
  onResult: OnResult;
  processRuntimeByName: ProcessRuntimeByName;
};

export default class BrowserRuntime extends Component<Props> {
  static contextType = BoardCtx;
  declare context: React.ContextType<typeof BoardCtx>;

  websocket: WebSocket | null | undefined = null;
  eventSource: EventSource | undefined = undefined;

  state = {};

  componentDidMount() {}

  componentWillUnmount() {
    //this.destroyRuntime();
  }

  // TODO: remove - but still used in headless and elsewhere
  getServiceById = (uuid: string) => {
    const { services, scope } = this.props;
    const svc = services.find((s) => s.uuid === uuid);
    return svc ? scope.findServiceInstance(svc.uuid) : null;
  };

  destroyRuntime = async () => {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
    if (this.websocket) {
      this.websocket.close();
      this.websocket = undefined;
    }

    const { scope } = this.props;
    removeRuntime(scope, scope.descriptor, scope.authenticatedUser);
  };

  render() {
    const {
      user,
      boardName,
      runtime,
      scope,
      services: rawServices,
      collapsed = false,
      className,
      onResult,
      onArrangeService,
      onServiceAction,
    } = this.props;

    const services: Array<ServiceInstance> = rawServices
      ? rawServices.flatMap((x) => {
          const svc = scope.findServiceInstance(x.uuid);
          if (svc && svc[0]) {
            return [{ ...svc[0], serviceName: x.serviceName }]; // The service name might have chnanged in the descriptor
          }
          return [];
        })
      : [];

    if (scope && scope.onResult !== onResult) {
      scope.onResult = onResult;
      scope.processRuntimeByName = this.props.processRuntimeByName;
      scope.authenticatedUser = user;
    }

    const onAction = (action: ServiceAction) => {
      if (action.action === "notification") {
        if (action.payload) {
          this.context?.appContext?.pushNotification(action.payload);
          return true;
        }
      }
      return false;
    };

    if (scope && scope.onAction !== onAction) {
      scope.onAction = onAction;
    }

    const onCreateServiceUI = (
      _boardName: string,
      service: ServiceInstance,
      _runtimeId: string,
      _userId: string | undefined
    ): ReactElement => {
      const serviceId = service.serviceId || service.__descriptor?.serviceId;
      if (!serviceId) {
        throw new Error(
          `ServiceId missing for service: ${JSON.stringify(service)}`
        );
      }
      const ui =
        findServiceUI(serviceId) ||
        scope.registry.findServiceModule(serviceId)?.createUI ||
        PlaceholderUI;

      const draggable = !!onArrangeService;
      return React.createElement(ui, {
        service,
        showBypassOnlyIfExplicit: false,
        draggable,
        onServiceAction,
      });
    };

    if (services?.length === 0) {
      return collapsed ? (
        <div />
      ) : (
        <EmptyRuntimePlaceholder runtime={runtime} />
      );
    }

    return (
      <ServiceUiContainer
        className={className}
        collapsed={collapsed}
        boardName={boardName}
        runtime={runtime}
        services={services}
        userId={user?.userId}
        onArrangeService={onArrangeService}
        onCreateServiceUi={onCreateServiceUI}
      />
    );
  }
}
