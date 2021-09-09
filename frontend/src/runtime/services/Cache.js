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
    const { 
      initial, 
      update,
      triggerProcess=false,
    } = config;
    if (initial !== undefined) {
      this.initial = initial;
    } else {
      this.values = { ...this.values, ...config }; // TODO: never take the whole config as cache
    }
    if (update !== undefined) {
      this.update = update;
    }
    this.app.notify(this, this.values);

    if (triggerProcess) {
      this.app.next(this, this.values);
    }
  }

  merge = p => {
    const params = Object.keys(p)
      .filter(x => p[x] !== undefined) // TODO: maybe the cached value could be undefined? define a way to invalidate the cache
      .reduce((a, c) => ({ ...a, [c]: p[c] }), {});
    return (this.values === undefined) ?
        { ...(this.initial || {}), ...params } : 
        { ...this.values, ...params };
  }

  async process(params) {
    const values = this.merge(params);
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