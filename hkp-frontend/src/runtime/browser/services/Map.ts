import MapDescriptor from "hkp-services/Map";

import MapUI from "./MapUI";
import { AppImpl, ServiceDescriptor } from "@/types";

const descriptor = {
  serviceName: MapDescriptor.serviceName,
  serviceId: MapDescriptor.serviceId,
  create: (
    app: AppImpl,
    board: string,
    descriptor: ServiceDescriptor,
    id: string
  ) => new MapDescriptor.service(app, board, descriptor, id),
  createUI: MapUI,
};

export default descriptor;
