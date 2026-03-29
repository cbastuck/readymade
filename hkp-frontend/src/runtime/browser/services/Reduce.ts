import ReduceDescriptor from "hkp-frontend/src/runtime/browser/services/base/Reduce";
import { AppInstance, ServiceClass } from "../../../types";

const descriptor = {
  serviceName: ReduceDescriptor.serviceName,
  serviceId: ReduceDescriptor.serviceId,
  create: (app: AppInstance, board: string, descriptor: ServiceClass, id: string) =>
    new (ReduceDescriptor as any).service(app, board, descriptor, id),
};

export default descriptor;
