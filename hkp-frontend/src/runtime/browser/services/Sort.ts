import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import SortUI from "./SortUI";

const serviceId = "hookup.to/service/sort";
const serviceName = "Sort";

export type Direction = "asc" | "desc";

type State = {
  by: string;
  dir: Direction;
};

class Sort extends ServiceBase<State> {
  constructor(app: AppInstance, board: string, descriptor: ServiceClass, id: string) {
    super(app, board, descriptor, id, { by: "", dir: "desc" });
  }

  configure(config: any) {
    if (config?.by !== undefined) {
      this.state.by = String(config.by);
      this.app.notify(this, { by: this.state.by });
    }
    if (config?.dir !== undefined) {
      this.state.dir = config.dir;
      this.app.notify(this, { dir: this.state.dir });
    }
    return this.state;
  }

  process(params: any): any {
    if (!Array.isArray(params) || !this.state.by) {
      return params;
    }
    const { by, dir } = this.state;
    return [...params].sort((a, b) => {
      const av = a[by];
      const bv = b[by];
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppInstance, board: string, descriptor: ServiceClass, id: string) =>
    new Sort(app, board, descriptor, id),
  createUI: SortUI,
};

export default descriptor;
