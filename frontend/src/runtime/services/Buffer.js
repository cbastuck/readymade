const serviceId = 'hookup.to/service/buffer';
const serviceName = 'Buffer';

class Buffer {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.buffer = [];
    this.capacity = 100;
  }

  configure(config) {
  }

  process(params) {
    const n = this.buffer.length;
    if (n < this.capacity) {
      this.buffer.push(params);
    } else {
      const diff = n - this.capacity + 1;
      this.buffer = this.buffer.slice(diff);
    }
    return this.buffer;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Buffer(app, board, descriptor, id),
};

export default descriptor;
