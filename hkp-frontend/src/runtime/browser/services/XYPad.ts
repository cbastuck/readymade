import { AppInstance, ServiceClass } from "@/types";
import ServiceBase from "./ServiceBase";
import XYPadUI from "./XYPadUI";

const serviceName = "XY Pad";
const serviceId = "hookup.to/service/xy-pad";

type State = {
  horizontalGridSteps: number;
  verticalGridSteps: number;
};

class XYPad extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      horizontalGridSteps: 0,
      verticalGridSteps: 0,
    });
  }

  configure(config: any) {
    const { position, eventType, horizontalGridSteps, verticalGridSteps } =
      config;

    if (horizontalGridSteps !== undefined) {
      this.state.horizontalGridSteps = horizontalGridSteps;
      this.app.notify(this, { horizontalGridSteps });
    }

    if (verticalGridSteps !== undefined) {
      this.state.verticalGridSteps = verticalGridSteps;
      this.app.notify(this, { verticalGridSteps });
    }

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
