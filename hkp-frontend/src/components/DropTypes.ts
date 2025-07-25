import { RuntimeDescriptor, ServiceInstance } from "hkp-frontend/src/types";

export const HKP_DND_SERVICE_TYPE = "application/hkp-service";
export const HKP_DND_RUNTIME_TYPE = "application/hkp-runtime";

export type ServiceInstanceDropType = ServiceInstance;
export function isServiceInstanceDrop(
  obj: any
): obj is ServiceInstanceDropType {
  return (
    !!obj &&
    obj.uuid &&
    ((obj.descriptor &&
      obj.descriptor.serviceId &&
      obj.descriptor.serviceName) ||
      (obj.serviceId && obj.serviceName))
  );
}

export type RuntimeDropType = RuntimeDescriptor;
export function isRuntimeDrop(obj: any): obj is RuntimeDropType {
  return !!obj && obj.id; // TODO
}
