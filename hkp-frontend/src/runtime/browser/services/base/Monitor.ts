import { AppInstance, ServiceClass } from "hkp-frontend/src/types";

/**
 * Service Documentation
 * Service ID: hookup.to/service/monitor
 * Service Name: Monitor
 * Modes: observe
 * Key Config: logToConsole
 * Input: any
 * Output: identity pass-through
 * Arrays: pass-through
 * Binary: inspectable in UI (Blob/ArrayBuffer/Uint8Array)
 * MixedData: not native in browser runtime
 */

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
