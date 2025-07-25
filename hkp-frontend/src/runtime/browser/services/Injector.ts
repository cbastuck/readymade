import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";

import InjectorUI from "./InjectorUI";

const serviceId = "hookup.to/service/injector";
const serviceName = "Injector";

type State = {
  recentInjection: any;
  plainText: boolean;
};
class Injector extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      recentInjection: undefined,
      plainText: false,
    });
  }

  configure(config: any) {
    const { inject, recentInjection, plainText } = config;
    if (inject !== undefined) {
      this.state.recentInjection = inject;
      this.app.next(this, inject);
    }

    if (recentInjection !== undefined) {
      this.state.recentInjection = recentInjection;
      this.app.notify(this, { recentInjection });
    }

    if (plainText !== undefined) {
      this.state.plainText = plainText;
      this.app.notify(this, { plainText });
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
