import { RuntimeDescriptor, ServiceInstance } from "@/types";

export const HKP_DND_SERVICE_TYPE = "application/hkp-service";
export const HKP_DND_RUNTIME_TYPE = "application/hkp-runtime";

type ServiceDropType = ServiceInstance;
export function isServiceDrop(obj: any): obj is ServiceDropType {
  return !!obj && obj.uuid; // TODO
}

type RuntimeDropType = RuntimeDescriptor;
export function isRuntimeDrop(obj: any): obj is RuntimeDropType {
  return !!obj && obj.id; // TODO
}
