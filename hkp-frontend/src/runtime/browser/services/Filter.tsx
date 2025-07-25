import FilterDescriptor from "hkp-frontend/src/runtime/browser/services/base/Filter";
import FilterUI from "./FilterUI";
import { AppInstance, ServiceClass } from "hkp-frontend/src/types";

const descriptor = {
  serviceName: FilterDescriptor.serviceName,
  serviceId: FilterDescriptor.serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) => new FilterDescriptor.service(app, board, descriptor, id),
  //new Filter(app, board, descriptor, id),
  createUI: FilterUI,
};

export default descriptor;
