import { ReactElement, useRef } from "react";

import {
  AppImpl,
  RuntimeApi,
  RuntimeClass,
  RuntimeDescriptor,
  RuntimeImpl,
  ServiceAction,
  ServiceClass,
  ServiceDescriptor,
  ServiceId,
  ServiceImpl,
} from "../types";
import ServiceUiContainer from "./ServiceUiContainer";
import {
  createFreeRuntime,
  createRuntimeService,
} from "../core/graphqlActions";

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

  const onCreateServiceUi = (
    boardName: string,
    service: ServiceImpl,
    runtimeId: string,
    userId: string
  ): ReactElement | null => {
    return null;
  };

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

export const RemoteRuntimeApi: RuntimeApi = {
  addService: async (runtime: RuntimeDescriptor, service: ServiceClass) => {
    const svc = await createRuntimeService(runtime, service);
    console.log("CREATED SERVICE", svc, runtime);
    return svc;
  },
  addRuntime: async (rtClass: RuntimeClass) => {
    const desc = await createFreeRuntime(rtClass);
    if (!desc) {
      return null;
    }

    const { registry, ...runtime } = desc;
    return { runtime: { ...rtClass, ...runtime }, services: [], registry };
  },
};
