import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import DebounceUI from "./DebounceUI";

const serviceId = "hookup.to/service/debounce";
const serviceName = "Debounce";

class Debounce {
  uuid: string;
  board: string;
  app: AppInstance;

  cooldown: number; // seconds
  lastFired: number | null;

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string,
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;
    this.cooldown = 60;
    this.lastFired = null;
  }

  configure(config: any): void {
    const { cooldown, reset } = config;

    if (cooldown !== undefined) {
      this.cooldown = cooldown;
      this.app.notify(this, { cooldown });
    }

    if (reset) {
      this.lastFired = null;
      this.app.notify(this, { lastFired: null, remaining: null });
    }
  }

  getConfiguration() {
    return Promise.resolve({ cooldown: this.cooldown, lastFired: this.lastFired });
  }

  process(params: any): any {
    const now = Date.now();
    const elapsed =
      this.lastFired !== null ? (now - this.lastFired) / 1000 : Infinity;

    if (elapsed >= this.cooldown) {
      this.lastFired = now;
      this.app.notify(this, { lastFired: now, remaining: null });
      return params;
    }

    const remaining = Math.ceil(this.cooldown - elapsed);
    this.app.notify(this, { remaining });
    return null;
  }
}

export default {
  serviceName,
  serviceId,
  create(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    return new Debounce(app, board, descriptor, id);
  },
  createUI: DebounceUI,
};
