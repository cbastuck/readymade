import TimerDescriptor from "hkp-frontend/src/runtime/browser/services/base/Timer";

import TimerUI from "./TimerUI";

const { serviceName, serviceId, service: Timer } = TimerDescriptor;
const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) => new Timer(app, board, descriptor, id),
  createUI: TimerUI,
};

export default descriptor;
