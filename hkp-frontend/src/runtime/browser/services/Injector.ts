import { AppInstance, ServiceClass } from "@/types";
import ServiceBase from "./ServiceBase";

import InjectorUI from "./InjectorUI";

const serviceId = "hookup.to/service/injector";
const serviceName = "Injector";

type State = {
  recentInjection: any;
};
class Injector extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, { recentInjection: undefined });
  }

  configure(config: any) {
    const { inject, recentInjection } = config;
    if (inject !== undefined) {
      this.state.recentInjection = inject;
      this.onStartProcess(inject);
      this.app.next(this, inject);
      this.onEndProcess(inject);
    }

    if (recentInjection !== undefined) {
      this.state.recentInjection = recentInjection;
    }
  }

  process(params: any) {
    return this.state.recentInjection || params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) => new Injector(app, board, descriptor, id),
  createUI: InjectorUI,
};

export default descriptor;
