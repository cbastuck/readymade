import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import LimitUI from "./LimitUI";

const serviceId = "hookup.to/service/limit";
const serviceName = "Limit";

type State = { n: number };

class Limit extends ServiceBase<State> {
  constructor(app: AppInstance, board: string, descriptor: ServiceClass, id: string) {
    super(app, board, descriptor, id, { n: 10 });
  }

  configure(config: any) {
    if (config?.n !== undefined) {
      this.state.n = Math.max(1, Number(config.n));
      this.app.notify(this, { n: this.state.n });
    }
    return this.state;
  }

  process(params: any): any {
    if (!Array.isArray(params)) {
      return params;
    }
    return params.slice(0, this.state.n);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppInstance, board: string, descriptor: ServiceClass, id: string) =>
    new Limit(app, board, descriptor, id),
  createUI: LimitUI,
};

export default descriptor;
