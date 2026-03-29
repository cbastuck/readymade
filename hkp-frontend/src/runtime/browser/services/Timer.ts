import TimerDescriptor from "hkp-frontend/src/runtime/browser/services/base/Timer";

import TimerUI from "./TimerUI";
import { AppInstance, ServiceClass } from "../../../types";

const { serviceName, serviceId, service: Timer } = TimerDescriptor;
const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppInstance, board: string, descriptor: ServiceClass, id: string) =>
    new Timer(app, board, descriptor, id),
  createUI: TimerUI,
};

export default descriptor;
