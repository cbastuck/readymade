const serviceId = "hookup.to/service/monitor";
const serviceName = "Monitor";

class Monitor {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
    this.logToConsole = false;
  }

  configure(config) {
    const { logToConsole } = config;
    if (logToConsole !== undefined) {
      this.logToConsole = logToConsole;
    }
  }

  process(params) {
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
