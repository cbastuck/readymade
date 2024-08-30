import { AppInstance, ServiceClass } from "@/types";
import BufferDescriptor from "@/runtime/browser/services/base/Buffer";
import BufferUI from "./BufferUI";

const descriptor = {
  serviceName: BufferDescriptor.serviceName,
  serviceId: BufferDescriptor.serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) => new BufferDescriptor.Buffer(app, board, descriptor, id),
  createUI: BufferUI,
};

export default descriptor;
