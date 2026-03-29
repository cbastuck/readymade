import React, { ReactElement, forwardRef, useContext, useImperativeHandle, useRef } from "react";

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
import { findServiceUI } from "./UIRegistry";
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

export type BrowserRuntimeHandle = {
  getServiceById: (uuid: string) => any;
  destroyRuntime: () => Promise<void>;
};

const BrowserRuntime = forwardRef<BrowserRuntimeHandle, Props>(function BrowserRuntime(props, ref) {
  const context = useContext(BoardCtx);

  const websocketRef = useRef<WebSocket | null | undefined>(null);
  const eventSourceRef = useRef<EventSource | undefined>(undefined);

  // TODO: remove - but still used in headless and elsewhere
  const getServiceById = (uuid: string) => {
    const { services, scope } = props;
    const svc = services.find((s) => s.uuid === uuid);
    return svc ? scope.findServiceInstance(svc.uuid) : null;
  };

  const destroyRuntime = async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = undefined;
    }
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = undefined;
    }

    const { scope } = props;
    removeRuntime(scope, scope.descriptor, scope.authenticatedUser);
  };

  useImperativeHandle(ref, () => ({
    getServiceById,
    destroyRuntime,
  }));

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
  } = props;

  const services: Array<ServiceInstance> = rawServices
    ? rawServices.flatMap((x) => {
        const svc = scope.findServiceInstance(x.uuid);
        if (svc && svc[0]) {
          // Keep instance identity stable so service UIs stay connected to the same service object.
          svc[0].serviceName = x.serviceName || svc[0].serviceName;
          return [svc[0]];
        }
        return [];
      })
    : [];

  if (scope && scope.onResult !== onResult) {
    scope.onResult = onResult;
    scope.processRuntimeByName = props.processRuntimeByName;
    scope.authenticatedUser = user;
  }

  const onAction = (action: ServiceAction) => {
    if (action.action === "notification") {
      if (action.payload) {
        context?.appContext?.pushNotification(action.payload);
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
    _userId: string | undefined,
  ): ReactElement => {
    const serviceId = service.serviceId || service.__descriptor?.serviceId;
    if (!serviceId) {
      throw new Error(
        `ServiceId missing for service: ${JSON.stringify(service)}`,
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
});

export default BrowserRuntime;
