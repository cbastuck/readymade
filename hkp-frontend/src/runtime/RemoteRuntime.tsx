import {
  RuntimeDescriptor,
  ServiceAction,
  ServiceDescriptor,
  ServiceRegistry,
} from "../types";
import ServiceUiContainer from "./ServiceUiContainer";
import defaultRegistry from "./registry/Default";

type Props = {
  userId: string;
  boardName: string;
  services: Array<ServiceDescriptor>;
  runtime: RuntimeDescriptor;
  readonly: boolean;
  registry: ServiceRegistry;
  onArrangeService: (serviceUuid: string, position: number) => void;
  onServiceAction: (command: ServiceAction) => void;
};
export default function RemoteRuntime({
  userId,
  boardName,
  services,
  runtime,
  readonly,
  onArrangeService,
  onServiceAction,
  registry,
}: Props) {
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
