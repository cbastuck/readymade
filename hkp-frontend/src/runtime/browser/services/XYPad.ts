import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import XYPadUI from "./XYPadUI";

const serviceName = "XY Pad";
const serviceId = "hookup.to/service/xy-pad";

type State = {
  gridRows: number;
  gridCols: number;
};

class XYPad extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      gridRows: 0,
      gridCols: 0,
    });
  }

  configure(config: any) {
    const { position, eventType, gridRows, gridCols } = config;

    if (gridRows !== undefined) {
      this.state.gridRows = gridRows;
      this.app.notify(this, { gridRows });
    }

    if (gridCols !== undefined) {
      this.state.gridCols = gridCols;
      this.app.notify(this, { gridCols });
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
