import { useRef } from "react";
import {
  RuntimeDescriptor,
  RuntimeImpl,
  ServiceAction,
  ServiceDescriptor,
  ServiceId,
  ServiceImpl,
  ServiceRegistry,
} from "../types";
import ServiceUiContainer from "./ServiceUiContainer";
import { defaultRegistry } from "./registry/Default";

type Props = {
  userId: string;
  boardName: string;
  services: Array<ServiceDescriptor>;
  runtime: RuntimeDescriptor;
  readonly: boolean;
  registry: ServiceRegistry;
  onRef: (i: RuntimeImpl) => void;
  onArrangeService: (serviceUuid: string, position: number) => void;
  onServiceAction: (command: ServiceAction) => void;
};

export default function RemoteRuntime({
  userId,
  boardName,
  services,
  runtime,
  registry,
  readonly,
  onRef,
  onArrangeService,
  onServiceAction,
}: Props) {
  const impl = useRef<RuntimeImpl>({
    getServiceById: (uuid: string): ServiceImpl | null => null,
    processRuntime: (params: any, svc: ServiceId | null): any => {},
    destroyService: (svcUuid: string) => {},
    destroyRuntime: () => {},
  });

  onRef(impl.current);
  const uiRegistry = registry.map(
    (r) => defaultRegistry.find((dr) => r.serviceId === dr.serviceId) || r
  );
  return (
    <ServiceUiContainer
      userId={userId}
      boardName={boardName}
      runtime={runtime}
      readonly={readonly}
      services={services}
      uiRegistry={uiRegistry}
      onArrangeService={onArrangeService}
      onServiceAction={onServiceAction}
    />
  );
}
