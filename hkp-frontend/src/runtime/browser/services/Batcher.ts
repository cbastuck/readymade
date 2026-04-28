import BatcherDescriptor from "hkp-frontend/src/runtime/browser/services/base/Batcher";
import { AppImpl, ServiceClass } from "hkp-frontend/src/types";

const descriptor = {
  serviceName: BatcherDescriptor.serviceName,
  serviceId: BatcherDescriptor.serviceId,
  create: (app: AppImpl, board: string, service: ServiceClass, id: string) =>
    new BatcherDescriptor.service(app, board, service, id),
};

export default descriptor;
