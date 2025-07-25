import MapDescriptor from "hkp-frontend/src/runtime/browser/services/base/Map";

import MapUI from "./MapUI";
import { AppImpl, ServiceClass } from "hkp-frontend/src/types";

const descriptor = {
  serviceName: MapDescriptor.serviceName,
  serviceId: MapDescriptor.serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new MapDescriptor.service(app, board, descriptor, id),
  createUI: MapUI,
};

export default descriptor;
