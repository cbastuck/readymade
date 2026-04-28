import BufferDescriptor from "hkp-frontend/src/runtime/browser/services/base/Buffer";
import { AppImpl, ServiceClass } from "hkp-frontend/src/types";

const descriptor = {
  serviceName: BufferDescriptor.serviceName,
  serviceId: BufferDescriptor.serviceId,
  create: (app: AppImpl, board: string, service: ServiceClass, id: string) =>
    new BufferDescriptor.service(app, board, service, id),
};

export default descriptor;
