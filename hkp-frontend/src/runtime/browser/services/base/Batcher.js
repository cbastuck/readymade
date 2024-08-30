const serviceId = "hookup.to/shared/batcher";
const serviceName = "Batcher";

function getTimestamp() {
  return new Date().getTime();
}

class Batcher {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.lastProcess = undefined;
    this.batch = [];
    this.minDelayInMsec = 1000;
  }

  configure(config) {
    const { minDelayInMsec } = config;
    if (minDelayInMsec !== undefined) {
      this.minDelayInMsec = minDelayInMsec;
    }
  }

  process(params) {
    if (params) {
      this.batch.push(params);
    }
    this.scheduleProcess();
    return null; // stop the chain
  }

  scheduleProcess() {
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

  sendBatch() {
    this.app.next(this, this.batch), (this.batch = []);
    this.timer = undefined;
  }
}

export default {
  serviceName,
  serviceId,
  service: Batcher,
};
