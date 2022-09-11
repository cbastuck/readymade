import { isArrayBuffer } from "./helpers";

const serviceId = "hookup.to/service/cache";
const serviceName = "Cache";

class Cache {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.updateTrigger = "config"; // alternatively: process
  }

  destroy() {}

  configure(config) {
    const { initial, updateTrigger, cacheMeta = {} } = config;

    if (initial !== undefined) {
      this.initial = initial;
    }

    if (updateTrigger !== undefined) {
      // what action updates the cache
      this.updateTrigger = updateTrigger;
    }

    const cachePlus = config["cache+"];
    if (cachePlus !== undefined) {
      this.values = this.merge(cachePlus);
    }

    const cachePropertiesPlus = config["cacheProperties+"];
    if (cachePropertiesPlus !== undefined) {
      const add = cachePropertiesPlus.reduce(
        (all, cur) => ({ ...all, [cur]: config[cur] }),
        {}
      );
      this.values = this.merge(add);
    }

    this.app.notify(this, this.values);

    const { triggerProcess } = cacheMeta;
    if (triggerProcess) {
      this.app.next(this, this.values);
    }
  }

  merge = (p) => {
    if (isArrayBuffer(p)) {
      this.values = p; // no merge with array buffers
      return this.values;
    }
    const params = Object.keys(p)
      .filter((x) => p[x] !== undefined) // TODO: maybe the cached value could be undefined? define a way to invalidate the cache
      .reduce((a, c) => ({ ...a, [c]: p[c] }), {});
    return this.values === undefined
      ? { ...(this.initial || {}), ...params }
      : { ...this.values, ...params };
  };

  async process(params) {
    if (this.updateTrigger === "process") {
      if (params !== undefined) {
        this.configure({ "cache+": params }); // in this case, process updates cache
      }
      return this.values;
    }

    return this.merge(params);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) => new Cache(app, board, descriptor, id),
  createUI: undefined,
};

export default descriptor;
