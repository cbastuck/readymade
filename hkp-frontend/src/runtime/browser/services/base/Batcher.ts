import { AppInstance, ServiceClass } from "hkp-frontend/src/types";

const serviceId = "hookup.to/shared/batcher";
const serviceName = "Batcher";

function getTimestamp(): number {
  return new Date().getTime();
}

class Batcher {
  uuid: string;
  board: string;
  app: AppInstance;

  lastProcess: number | undefined;
  batch: any[];
  minDelayInMsec: number;
  timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.lastProcess = undefined;
    this.batch = [];
    this.minDelayInMsec = 1000;
  }

  configure(config: any): void {
    const { minDelayInMsec } = config;
    if (minDelayInMsec !== undefined) {
      this.minDelayInMsec = minDelayInMsec;
    }
  }

  process(params: any): null {
    if (params) {
      this.batch.push(params);
    }
    this.scheduleProcess();
    return null; // stop the chain
  }

  scheduleProcess(): void {
    if (this.timer) {
      return; // timer already scheduled
    }

    let delay = this.minDelayInMsec;
    if (this.lastProcess === undefined) {
      delay = 0;
    } else {
      const diff = this.minDelayInMsec - (getTimestamp() - this.lastProcess);
      delay = diff < 0 ? 0 : diff;
    }

    this.timer = setTimeout(this.sendBatch.bind(this), delay);
  }

  sendBatch(): void {
    this.app.next(this, this.batch), (this.batch = []);
    this.timer = undefined;
  }
}

export default {
  serviceName,
  serviceId,
  service: Batcher,
};
