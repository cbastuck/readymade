import { RuntimeDescriptor, ServiceClass, ServiceInstance } from "@/types";

export const HKP_DND_SERVICE_TYPE = "application/hkp-service";
export const HKP_DND_RUNTIME_TYPE = "application/hkp-runtime";

export type ServiceDropType = {
  svcClass: ServiceClass;
  instance: ServiceInstance;
};
export function isServiceDrop(obj: any): obj is ServiceDropType {
  return (
    !!obj &&
    obj.svcClass &&
    obj.svcClass.serviceId &&
    obj.svcClass.serviceName &&
    obj.instance &&
    obj.instance.uuid
  );
}

export type RuntimeDropType = RuntimeDescriptor;
export function isRuntimeDrop(obj: any): obj is RuntimeDropType {
  return !!obj && obj.id; // TODO
}
