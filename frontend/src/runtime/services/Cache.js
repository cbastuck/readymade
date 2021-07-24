const serviceId = 'hookup.to/service/cache';
const serviceName = 'Cache';

class Cache {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.cached = {};
  }

  destroy() {
  }

  configure(config) { 
  }

  async process(params) {
    this.cached = {
      ...this.cached,
      ...params,
    }
    return this.cached;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Cache(app, board, descriptor, id),
  createUI: undefined,
};

export default descriptor;