import { AppInstance, ServiceClass } from "@/types";
import ServiceBase from "./ServiceBase";
import XYPadUI from "./XYPadUI";

const serviceName = "XY Pad";
const serviceId = "hookup.to/service/xy-pad";

class XYPad extends ServiceBase<{}> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {});
  }

  configure(config: any) {
    const { position, eventType } = config;
    if (position !== undefined) {
      this.app.next(this, {
        ...position,
        eventType,
        timestamp: performance.now(),
      });
    }
  }

  process(params: any) {
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) => new XYPad(app, board, descriptor, id),
  createUI: XYPadUI,
};

export default descriptor;
