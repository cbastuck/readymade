import { isArrayBuffer } from "./helpers";
import { AppInstance, ServiceClass } from "../../../types";

const serviceId = "hookup.to/service/cache";
const serviceName = "Cache";

interface CacheConfig {
  initial?: any;
  updateTrigger?: string;
  cacheMeta?: { triggerProcess?: boolean };
  "cache+"?: any;
  "cacheProperties+"?: string[];
  [key: string]: any;
}

class Cache {
  uuid: string;
  board: string;
  app: AppInstance;
  updateTrigger: string;
  initial: any;
  values: any;

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.updateTrigger = "config"; // alternatively: process
  }

  destroy(): void {}

  configure(config: CacheConfig): void {
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
        (all: Record<string, any>, cur: string) => ({
          ...all,
          [cur]: config[cur],
        }),
        {}
      );
      this.values = this.merge(add);
    }

    this.app.notify(this as any, this.values);

    const { triggerProcess } = cacheMeta;
    if (triggerProcess) {
      this.app.next(this as any, this.values);
    }
  }

  merge = (p: any): any => {
    if (isArrayBuffer(p)) {
      this.values = p; // no merge with array buffers
      return this.values;
    }
    const params = Object.keys(p)
      .filter((x) => p[x] !== undefined) // TODO: maybe the cached value could be undefined? define a way to invalidate the cache
      .reduce((a: Record<string, any>, c: string) => ({ ...a, [c]: p[c] }), {});
    return this.values === undefined
      ? { ...(this.initial || {}), ...params }
      : { ...this.values, ...params };
  };

  async process(params: any): Promise<any> {
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
  create: (app: AppInstance, board: string, desc: ServiceClass, id: string) =>
    new Cache(app, board, desc, id),
  createUI: undefined,
};

export default descriptor;
