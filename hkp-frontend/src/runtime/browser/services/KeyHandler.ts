import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import KeyHandlerUI from "./KeyHandlerUI";

const serviceId = "hookup.to/service/key-handler";
const serviceName = "KeyHandler";

export type State = {
  eventType: "keydown" | "keyup" | "keypress";
};

class KeyHandler extends ServiceBase<State> {
  _listenerAdded: boolean = false;
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, { eventType: "keypress" });
    this.bypass = true;
  }

  destroy() {
    if (this._listenerAdded) {
      if (this.state.eventType === "keypress") {
        document.removeEventListener("keydown", this.onEvent);
        document.removeEventListener("keyup", this.onEvent);
      } else {
        document.removeEventListener(this.state.eventType, this.onEvent);
      }
      this._listenerAdded = false;
    }
  }

  onEvent = (e: KeyboardEvent) => {
    this.app.next(this, { key: e.key, code: e.keyCode, type: e.type });
    e.preventDefault();
    e.stopPropagation();
  };

  configure(config: any) {
    const { eventType, bypass } = config;
    if (eventType !== undefined && this.state.eventType !== eventType) {
      this.state.eventType = eventType;
    }

    if (bypass === true) {
      this.destroy();
      this.bypass = true;
      this.app.notify(this, { bypass });
    }

    if (!this._listenerAdded && bypass === false) {
      if (this.state.eventType === "keypress") {
        document.addEventListener("keydown", this.onEvent);
        document.addEventListener("keyup", this.onEvent);
      } else {
        document.addEventListener(this.state.eventType, this.onEvent);
      }

      this._listenerAdded = true;
      this.bypass = false;
      this.app.notify(this, { bypass });
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
  ) => new KeyHandler(app, board, descriptor, id),
  createUI: KeyHandlerUI,
};

export default descriptor;
