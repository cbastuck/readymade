import { AppInstance, ServiceClass } from "hkp-frontend/src/types";

const serviceId = "hookup.to/service/monitor";
const serviceName = "Monitor";

class Monitor {
  uuid: string;
  board: string;
  app: AppInstance;
  logToConsole: boolean;

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string,
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;
    this.logToConsole = false;
  }

  configure(config: any): void {
    const { logToConsole } = config;
    if (logToConsole !== undefined) {
      this.logToConsole = logToConsole;
    }
  }

  process(params: any): any {
    this.app.notify(this, params);
    if (this.logToConsole) {
      console.log("Monitor: ", params);
    }
    return params;
  }
}

export default {
  serviceName,
  serviceId,
  service: Monitor,
};
