import { ReactElement } from "react";

import {
  RuntimeDescriptor,
  ServiceAction,
  ServiceDescriptor,
  ServiceImpl,
  RuntimeScope,
  OnResult,
} from "../../types";
import ServiceUiContainer from "../ServiceUiContainer";

import { createPlaceholderUI } from "../../UIFactory";
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
  const servicesWithImpl: Array<ServiceImpl> = scope
    ? services.map((svc: ServiceDescriptor) => ({
        ...svc,
        board: boardName,
        app: scope.getApp(),
        process: async (params: any): Promise<any> =>
          processService(scope, svc, params, null), // TODO: passing null as requestId
        configure: async (config: any): Promise<void> =>
          configureService(scope, svc, config),
        destroy: async (): Promise<void> => {},
      }))
    : [];

  if (scope && scope.onResult !== onResult) {
    scope.onResult = onResult;
  }
  return (
    <ServiceUiContainer
      userId={userId}
      boardName={boardName}
      runtime={runtime}
      readonly={readonly}
      services={servicesWithImpl}
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
  const props = {
    service,
    board: boardName,
    runtimeId,
    key: `key-${service.uuid}`,
  };
  const Ui = serviceId && createServiceUI(serviceId);
  return Ui ? <Ui {...props} /> : createPlaceholderUI(service);
};
