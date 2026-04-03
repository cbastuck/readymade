import { ReactElement, useCallback, useEffect, useState } from "react";

import {
  RuntimeDescriptor,
  ServiceAction,
  ServiceDescriptor,
  RuntimeScope,
  OnResult,
  User,
  RuntimeApi,
  ServiceInstance,
} from "../../types";
import ServiceUiContainer from "../ServiceUiContainer";

import RuntimeGraphQLServiceUI from "./RuntimeGraphQLServiceUI";
import { findServiceUI } from "./UIRegistry";
import React from "react";
import EmptyRuntimePlaceholder from "hkp-frontend/src/ui-components/runtime-ui/EmptyRuntimePlaceholder";

type Props = {
  user: User | null;
  boardName: string;
  services: Array<ServiceDescriptor>;
  runtime: RuntimeDescriptor;
  scope: RuntimeScope;
  children?: JSX.Element | JSX.Element[];
  collapsed?: boolean;
  onArrangeService: (serviceUuid: string, position: number) => void;
  onServiceAction: (command: ServiceAction) => void;
  onResult: OnResult;
};

export default function RuntimeGraphQL({
  user,
  boardName,
  services,
  runtime,
  scope,
  collapsed,
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
    setServicesWithConfig(makeServiceInstances(services));
  }, [services, makeServiceInstances]);

  if (scope.onResult !== onResult) {
    scope.onResult = onResult;
    scope.authenticatedUser = user;
  }

  scope.onConfig = (instanceId: string, config: object) => {
    setServicesWithConfig((prevState) =>
      prevState.map((prevSvc) =>
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
    const { serviceId } = service;
    const ui =
      (serviceId && findServiceUI(serviceId)) || RuntimeGraphQLServiceUI;

    return React.createElement(ui, {
      service,
      showBypassOnlyIfExplicit: true,
      draggable: false,
      onServiceAction,
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
  return {
    ...svc,
    board: boardName,
    app: scope.getApp(),
    process: async (params: any): Promise<any> =>
      api.processService(scope, svc, params, null), // TODO: passing null as requestId
    configure: async (config: object): Promise<void> => {
      await api.configureService(scope, svc, config);
    },
    getConfiguration: (): Promise<any> => {
      return api.getServiceConfig(scope, svc);
    },
    destroy: async (): Promise<void> => {},
  };
}
