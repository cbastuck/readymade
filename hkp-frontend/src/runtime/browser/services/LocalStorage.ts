import { AppImpl, AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import LocalStorageUI from "./LocalStorageUI";

const serviceId = "hookup.to/service/local-storage";
const serviceName = "Local Storage";

type State = {
  filter: string;
};

class LocalStorage extends ServiceBase<State> {
  items: Array<{ key: string; value: string }> = [];

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, { filter: "" });
  }

  retrieveAndCacheItems(filter?: string) {
    const items: Array<{ key: string; value: string }> = [];
    for (const key in localStorage) {
      if (!filter || key.startsWith(filter)) {
        const value = localStorage.getItem(key);
        if (value) {
          items.push({ key, value });
        }
      }
    }
    this.items = items;
    return this.items;
  }

  configure(config: any) {
    const { filter, process } = config;

    if (filter !== undefined || this.items.length === 0) {
      this.state.filter = filter;
      this.retrieveAndCacheItems(filter);
      this.app.notify(this, { items: this.items, filter });
    }

    if (process) {
      return this.app.next(this, this.process(undefined));
    }
  }

  process(_params: any) {
    return this.retrieveAndCacheItems(this.state.filter);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new LocalStorage(app, board, descriptor, id),
  createUI: LocalStorageUI,
};

export default descriptor;
