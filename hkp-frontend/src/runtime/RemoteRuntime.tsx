import { ReactElement, useRef } from "react";

import {
  AppImpl,
  RuntimeDescriptor,
  RuntimeImpl,
  ServiceAction,
  ServiceDescriptor,
  ServiceId,
  ServiceImpl,
} from "../types";
import ServiceUiContainer from "./ServiceUiContainer";

import { createPlaceholderUI } from "../UIFactory";

type Props = {
  userId: string;
  boardName: string;
  services: Array<ServiceDescriptor>;
  runtime: RuntimeDescriptor;
  readonly: boolean;
  children?: JSX.Element | JSX.Element[];
  onRef: (i: RuntimeImpl) => void;
  onArrangeService: (serviceUuid: string, position: number) => void;
  onServiceAction: (command: ServiceAction) => void;
};

export default function RemoteRuntime({
  userId,
  boardName,
  services,
  runtime,
  readonly,
  onRef,
  onArrangeService,
  onServiceAction,
}: Props) {
  const impl = useRef<RuntimeImpl>({
    getServiceById: (uuid: string): ServiceImpl | null => null,
    processRuntime: async (params: any, svc: ServiceId | null) => {},
    destroyService: async (svcUuid: string) => {},
    configureService: async (uuid: string, config: any) => {},
    destroyRuntime: async () => {},
  });

  onRef(impl.current);

  const app: AppImpl = {
    notify: (svc: ServiceImpl, notification: any): void => {},
    next: (svc: ServiceId | null, result: any): void => {},
    getServiceById: (uuid: string): ServiceImpl | null => {
      return null;
    },
    sendAction: (action: ServiceAction): void => {},
    storeServiceData: (
      serviceUuid: string,
      key: string,
      value: string
    ): void => {},
    restoreServiceData: (serviceUuid: string, key: string): void => {},
    removeServiceData: (serviceUuid: string, key: string): void => {},
    createSubService: (
      parent: ServiceImpl,
      service: ServiceDescriptor
    ): void => {},
    createSubServiceUI: (svc: ServiceImpl): void => {},
  };

  const servicesWithImpl: Array<ServiceImpl> = services.map(
    (svc: ServiceDescriptor) => ({
      ...svc,
      board: boardName,
      app,
      process: async (params: any): Promise<any> => {},
      configure: async (config: any): Promise<void> => {},
      destroy: async (): Promise<void> => {},
    })
  );
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
