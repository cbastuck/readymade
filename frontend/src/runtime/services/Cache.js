const serviceId = 'hookup.to/service/cache';
const serviceName = 'Cache';

class Cache {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.update = 'config';
    this.triggerProcess = false;
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
    } 

    if (update !== undefined) {
      this.update = update;
    }
    
    const cachePlus = config.['cache+'];
    if ( cachePlus !== undefined) {
      this.values = this.merge(cachePlus);
    }

    const cachePropertiesPlus = config['cacheProperties+'];
    if (cachePropertiesPlus !== undefined) {
      const add = cachePropertiesPlus.reduce((all, cur) => ({ ...all, [cur]: config[cur] }), {});
      this.values = this.merge(add);
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
    if (this.update === 'process') { // process updates cache
      this.configure({ 'cache+': params });
      return this.values;
    } else {
      return this.merge(params);
    }
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