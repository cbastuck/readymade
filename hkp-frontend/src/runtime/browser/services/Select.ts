import { AppInstance, ServiceClass } from "../../../types";
import ServiceBase from "./ServiceBase";
import SelectUI from "./SelectUI";

const serviceId = "hookup.to/service/select";
const serviceName = "Select";

type State = { arrayIndex: number };

class Select extends ServiceBase<State> {
  constructor(app: AppInstance, board: string, descriptor: ServiceClass, id: string) {
    super(app, board, descriptor, id, { arrayIndex: 0 });
  }

  configure(config: { arrayIndex?: number }): any {
    if (config?.arrayIndex !== undefined) {
      this.state.arrayIndex = Math.max(0, Number(config.arrayIndex));
      this.app.notify(this, { arrayIndex: this.state.arrayIndex });
    }
    return this.state;
  }

  process(params: any): any {
    if (Array.isArray(params)) {
      return params[this.state.arrayIndex];
    }
    console.warn("Unsupported input type, can't select");
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppInstance, board: string, desc: ServiceClass, id: string) =>
    new Select(app, board, desc, id),
  createUI: SelectUI,
};

export default descriptor;
