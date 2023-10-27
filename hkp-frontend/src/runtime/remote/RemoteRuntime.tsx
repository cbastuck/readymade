import { ReactElement, useRef } from "react";

import {
  AppImpl,
  RuntimeDescriptor,
  RuntimeImpl,
  ServiceAction,
  ServiceDescriptor,
  InstanceId,
  ServiceImpl,
  RuntimeScope,
} from "../../types";
import ServiceUiContainer from "../ServiceUiContainer";

import { createPlaceholderUI } from "../../UIFactory";

type Props = {
  userId: string;
  boardName: string;
  services: Array<ServiceDescriptor>;
  runtime: RuntimeDescriptor;
  readonly: boolean;
  children?: JSX.Element | JSX.Element[];
  scope: RuntimeScope;
  // onRef: (i: RuntimeImpl) => void;
  onArrangeService: (serviceUuid: string, position: number) => void;
  onServiceAction: (command: ServiceAction) => void;
};

export default function RemoteRuntime({
  userId,
  boardName,
  services,
  runtime,
  readonly,
  scope,
  //onRef,
  onArrangeService,
  onServiceAction,
}: Props) {
  const impl = useRef<RuntimeImpl>({
    getServiceById: (uuid: string): ServiceImpl | null => null,
    processRuntime: async (params: any, svc: InstanceId | null) => {},
    destroyService: async (svcUuid: string) => {},
    configureService: async (uuid: string, config: any) => {},
    destroyRuntime: async () => {},
  });

  //onRef(impl.current);

  const servicesWithImpl: Array<ServiceImpl> = scope
    ? services.map((svc: ServiceDescriptor) => ({
        ...svc,
        board: boardName,
        app: scope.getApp(),
        process: async (params: any): Promise<any> => {},
        configure: async (config: any): Promise<void> => {},
        destroy: async (): Promise<void> => {},
      }))
    : [];

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
  return createPlaceholderUI(service);
};
