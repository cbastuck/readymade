import { ReactElement, useCallback, useEffect, useState } from "react";

import {
  RuntimeDescriptor,
  ServiceAction,
  ServiceDescriptor,
  ServiceImpl,
  RuntimeScope,
  OnResult,
  User,
} from "../../types";
import ServiceUiContainer from "../ServiceUiContainer";

import RemoteServiceUI from "./RemoteServiceUI";
import createServiceUI from "./UIRegistry";
import { configureService, processService } from "./RemoteRuntimeApi";

type Props = {
  user: User | null;
  boardName: string;
  services: Array<ServiceDescriptor>;
  runtime: RuntimeDescriptor;
  readonly: boolean;
  scope: RuntimeScope;
  children?: JSX.Element | JSX.Element[];
  collapsed?: boolean;
  onArrangeService: (serviceUuid: string, position: number) => void;
  onServiceAction: (command: ServiceAction) => void;
  onResult: OnResult;
};

export default function RemoteRuntime({
  user,
  boardName,
  services,
  runtime,
  readonly,
  scope,
  collapsed,
  onResult,
  onArrangeService,
  onServiceAction,
}: Props) {
  const makeServiceWithConfig = useCallback(
    (services: Array<ServiceDescriptor>) =>
      services.map((svc: ServiceDescriptor) => ({
        ...svc,
        board: boardName,
        app: scope.getApp(),
        process: async (params: any): Promise<any> =>
          processService(scope, svc, params, null), // TODO: passing null as requestId
        configure: async (config: object): Promise<void> => {
          await configureService(scope, svc, config);
        },
        destroy: async (): Promise<void> => {},
      })),
    [scope, boardName]
  );

  const [servicesWithConfig, setServicesWithConfig] = useState<
    Array<ServiceImpl>
  >(makeServiceWithConfig(services));

  useEffect(() => {
    setServicesWithConfig(makeServiceWithConfig(services));
  }, [services, makeServiceWithConfig]);

  if (scope.onResult !== onResult) {
    scope.onResult = onResult;
    scope.authenticatedUser = user;
  }
  scope.onConfig = (instanceId: string, config: object) => {
    setServicesWithConfig((prevState) =>
      prevState.map((prevSvc) =>
        prevSvc.uuid === instanceId ? { ...prevSvc, ...config } : prevSvc
      )
    );
  };

  return (
    !collapsed && (
      <ServiceUiContainer
        userId={user?.userId}
        boardName={boardName}
        runtime={runtime}
        readonly={readonly}
        services={servicesWithConfig}
        showBypassOnlyIfExplicit={true}
        onArrangeService={onArrangeService}
        onServiceAction={onServiceAction}
        onCreateServiceUi={onCreateServiceUi}
      />
    )
  );
}

const onCreateServiceUi = (
  boardName: string,
  service: ServiceImpl,
  runtimeId: string,
  userId: string | undefined
): ReactElement | null => {
  const { serviceId } = service;

  const Ui = serviceId && createServiceUI(serviceId);
  return Ui ? (
    <Ui
      {...{
        service,
        board: boardName,
        runtimeId,
        key: `key-${service.uuid}`,
      }}
    />
  ) : (
    <RemoteServiceUI service={service} />
  );
};
