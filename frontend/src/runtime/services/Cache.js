const serviceId = 'hookup.to/service/cache';
const serviceName = 'Cache';

class Cache {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.update = 'config';
  }

  destroy() {
  }

  configure(config) {
    const { initial } = config;
    if (initial !== undefined) {
      this.initial = initial;
    } else {
      this.values = { ...this.values, ...config };
    }
    this.app.notify(this, this.values);
  }

  async process(params) {
    const values = (this.values === undefined) ?
        { ...(this.initial || {}), ...params } : 
        { ...this.values, ...params };
    if (this.update === 'process') { // process updates cache
      this.values = values;
    }
    return values;
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