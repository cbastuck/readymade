import { ReactElement, useState } from "react";

import {
  RuntimeDescriptor,
  ServiceAction,
  ServiceDescriptor,
  ServiceImpl,
  RuntimeScope,
  OnResult,
} from "../../types";
import ServiceUiContainer from "../ServiceUiContainer";

import RemoteServiceUI from "./RemoteServiceUI";
import createServiceUI from "./UIRegistry";
import { configureService, processService } from "./RemoteRuntimeApi";

type Props = {
  userId: string;
  boardName: string;
  services: Array<ServiceDescriptor>;
  runtime: RuntimeDescriptor;
  readonly: boolean;
  children?: JSX.Element | JSX.Element[];
  scope: RuntimeScope;
  onArrangeService: (serviceUuid: string, position: number) => void;
  onServiceAction: (command: ServiceAction) => void;
  onResult: OnResult;
};

export default function RemoteRuntime({
  userId,
  boardName,
  services,
  runtime,
  readonly,
  scope,
  onResult,
  onArrangeService,
  onServiceAction,
}: Props) {
  const [servicesWithConfig, setServicesWithConfig] = useState<
    Array<ServiceImpl>
  >(
    services.map((svc: ServiceDescriptor) => ({
      ...svc,
      board: boardName,
      app: scope.getApp(),
      process: async (params: any): Promise<any> =>
        processService(scope, svc, params, null), // TODO: passing null as requestId
      configure: async (config: object): Promise<void> => {
        const newConfig = await configureService(scope, svc, config);
        setServicesWithConfig((prevState) =>
          prevState.map((prevSvc) =>
            prevSvc.uuid === svc.uuid ? { ...prevSvc, ...newConfig } : prevSvc
          )
        );
      },
      destroy: async (): Promise<void> => {},
    }))
  );

  if (scope && scope.onResult !== onResult) {
    scope.onResult = onResult;
  }
  return (
    <ServiceUiContainer
      userId={userId}
      boardName={boardName}
      runtime={runtime}
      readonly={readonly}
      services={servicesWithConfig}
      onArrangeService={onArrangeService}
      onServiceAction={onServiceAction}
      onCreateServiceUi={onCreateServiceUi}
    />
  );
}

const onCreateServiceUi = (
  boardName: string,
  service: ServiceImpl,
  runtimeId: string,
  userId: string
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
