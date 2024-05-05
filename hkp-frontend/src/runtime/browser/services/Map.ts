import MapDescriptor from "hkp-services/Map";

import MapUI from "./MapUI";
import { AppImpl, ServiceClass } from "@/types";

const descriptor = {
  serviceName: MapDescriptor.serviceName,
  serviceId: MapDescriptor.serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new MapDescriptor.service(app, board, descriptor, id),
  createUI: MapUI,
};

export default descriptor;
