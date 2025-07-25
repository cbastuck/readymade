import { AppInstance, ServiceClass } from "hkp-frontend/src/types";

export default class ServiceBase<T> {
  uuid: string;
  board: string;
  app: AppInstance;
  descriptor: ServiceClass;
  state: T;
  bypass: boolean = false;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    uuid: string,
    s: T
  ) {
    this.uuid = uuid;
    this.board = board;
    this.app = app;
    this.state = s;
    this.descriptor = descriptor;
  }

  getConfiguration = async () => {
    return { ...this.state, bypass: this.bypass };
  };

  setBypass = (bypass: boolean) => {
    if (!!this.bypass !== !!bypass) {
      this.bypass = !!bypass;
      this.app.notify(this as any, { bypass: this.bypass }); // TODO: as any - refactor interface
    }
  };

  pushErrorNotification = (message: string) => {
    this.app.sendAction({
      action: "notification",
      service: this as any, // TODO: ServiceInstance is
      payload: {
        type: "error",
        message,
      },
    });
  };
}
