import TimerDescriptor from "hkp-services/Timer";

import TimerUI from "./TimerUI";

const { serviceName, serviceId, service: Timer } = TimerDescriptor;
const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) => new Timer(app, board, descriptor, id),
  createUI: TimerUI,
};

export default descriptor;
