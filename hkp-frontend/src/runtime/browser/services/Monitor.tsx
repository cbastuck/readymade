import { AppImpl, ServiceClass } from "@/types";

import MonitorDescriptor from "@/runtime/browser/services/base/Monitor";
import MonitorUI from "./MonitorUI";

const { serviceName, serviceId, service: Monitor } = MonitorDescriptor;
const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new Monitor(app, board, descriptor, id),
  createUI: MonitorUI,
};

export default descriptor;
