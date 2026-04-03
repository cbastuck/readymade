import React, { ReactElement, useCallback, useEffect, useState } from "react";

import {
  RuntimeDescriptor,
  ServiceAction,
  ServiceDescriptor,
  RuntimeScope,
  OnResult,
  User,
  RuntimeApi,
  ServiceInstance,
  InitialServiceFrameState,
} from "../../types";
import ServiceUiContainer from "../ServiceUiContainer";

import RemoteServiceUI from "./RealtimeRuntimeServiceUI";
import { findServiceUI } from "./UIRegistry";
import EmptyRuntimePlaceholder from "hkp-frontend/src/ui-components/runtime-ui/EmptyRuntimePlaceholder";

type Props = {
  user: User | null;
  boardName: string;
  services: Array<ServiceDescriptor>;
  runtime: RuntimeDescriptor;
  scope: RuntimeScope;
  children?: JSX.Element | JSX.Element[];
  collapsed?: boolean;
  initialServiceFrameState?: InitialServiceFrameState;
  wrapServices?: boolean;
  onArrangeService: (serviceUuid: string, position: number) => void;
  onServiceAction: (command: ServiceAction) => void;
  onResult: OnResult;
};

export default function RuntimeRest({
  user,
  boardName,
  services,
  runtime,
  scope,
  collapsed,
  initialServiceFrameState,
  wrapServices,
  onResult,
  onArrangeService,
  onServiceAction,
}: Props) {
  const makeServiceInstances = useCallback(
    (services: Array<ServiceDescriptor>) =>
      services.map((svc) => makeServiceInstance(scope, svc, boardName)),
    [scope, boardName],
  );

  const [servicesWithConfig, setServicesWithConfig] = useState<
    Array<ServiceInstance>
  >(makeServiceInstances(services));

  useEffect(() => {
    // Merge: preserve in-memory state (from scope.onConfig updates) for
    // services that are already tracked, and only create fresh instances for
    // newly-added services. This prevents a full rebuild from the stale
    // BoardContext descriptors from overwriting live config updates.
    setServicesWithConfig((prev) => {
      const prevMap = new Map(prev.map((s) => [s.uuid, s]));
      return makeServiceInstances(services).map(
        (newInst) => prevMap.get(newInst.uuid) ?? newInst,
      );
    });
  }, [services, makeServiceInstances]);

  if (scope.onResult !== onResult) {
    scope.onResult = onResult;
    scope.authenticatedUser = user;
  }

  scope.onConfig = (instanceId: string, config: object) => {
    setServicesWithConfig((prevState) =>
      prevState.map((prevSvc) =>
        // TODO: this assumes config is of type {state: object }
        prevSvc.uuid === instanceId ? { ...prevSvc, ...config } : prevSvc,
      ),
    );
  };

  const onCreateServiceUi = (
    _boardName: string,
    service: ServiceInstance,
    _runtimeId: string,
    _userId: string | undefined,
  ): ReactElement => {
    const ui =
      findServiceUI({
        serviceId: service.serviceId,
        version: service.version,
        capabilities: service.capabilities,
      }) || RemoteServiceUI;

    return React.createElement(ui, {
      service,
      showBypassOnlyIfExplicit: true,
      draggable: false,
      onServiceAction,
      serviceFrameState: initialServiceFrameState,
    });
  };

  if (services?.length === 0) {
    return <EmptyRuntimePlaceholder runtime={runtime} />;
  }

  return (
    !collapsed && (
      <div className="flex overflow-x-auto">
        <ServiceUiContainer
          className="flex"
          userId={user?.userId}
          boardName={boardName}
          runtime={runtime}
          services={servicesWithConfig}
          wrapServices={wrapServices}
          onArrangeService={onArrangeService}
          onCreateServiceUi={onCreateServiceUi}
        />
      </div>
    )
  );
}

export function makeServiceInstance(
  scope: RuntimeScope,
  svc: ServiceDescriptor,
  boardName: string,
): ServiceInstance {
  const api: RuntimeApi = scope.getApi();
  const descriptor = scope
    .getApp()
    .listAvailableServices()
    .find((entry) => entry.serviceId === svc.serviceId);

  const normalizedService: ServiceDescriptor = {
    ...svc,
    serviceName: svc.serviceName || descriptor?.serviceName || svc.serviceId,
    version: svc.version ?? descriptor?.version,
    capabilities: svc.capabilities ?? descriptor?.capabilities,
  };

  return {
    ...normalizedService,
    board: boardName,
    app: scope.getApp(),
    process: async (params: any): Promise<any> =>
      api.processService(scope, normalizedService, params, null), // TODO: passing null as requestId
    configure: async (config: object): Promise<void> => {
      await api.configureService(scope, normalizedService, config);
    },
    getConfiguration: (): Promise<any> => {
      return api.getServiceConfig(scope, normalizedService);
    },
    destroy: async (): Promise<void> => {},
  };
}
