const serviceId = 'hookup.to/service/timer';
const serviceName = 'Timer';

class Timer {
  constructor(app, board, descriptor, id) {
    this.id = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    } else {
      this.count = 0;
      this.timer = setInterval(this.process.bind(this), 1000);
    }
  }

  process() {
    this.app.next(this, { triggerCount: ++this.count });
  }
}

const descriptor = {  
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Timer(app, board, descriptor, id)
};

export default descriptor;
