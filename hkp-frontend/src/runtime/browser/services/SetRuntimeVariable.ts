import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import SetRuntimeVariableUI from "./SetRuntimeVariableUI";

const serviceId = "hookup.to/service/set-runtime-variable";
const serviceName = "Set Runtime Variable";

type State = {
  key: string;
  value: any;
};

class SetRuntimeVariable {
  uuid: string;
  board: string;
  app: AppInstance;
  state: State;
  bypass: boolean = false;

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string,
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;
    this.state = { key: "", value: null };
  }

  configure(config: any): void {
    if (config.key !== undefined) {
      this.state.key = config.key;
    }
    if (config.value !== undefined) {
      this.state.value = config.value;
    }
    this.app.notify(this, { ...this.state });
  }

  process(params: any): any {
    if (this.state.key) {
      this.app.setRuntimeVariable(this.state.key, this.state.value);
    }
    return params;
  }

  getConfiguration() {
    return { ...this.state, bypass: this.bypass };
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new SetRuntimeVariable(app, board, descriptor, id),
  createUI: SetRuntimeVariableUI,
};

export default descriptor;
