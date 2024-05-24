import * as uuid from "uuid";
import { AppInstance, ServiceClass } from "@/types";
import UuidGeneratorUI from "./UuidGeneratorUI";
import ServiceBase from "./ServiceBase";
import { needsUpdate } from "@/ui-components/service/ServiceUI";

const serviceId = "hookup.to/service/uuid-generator";
const serviceName = "Uuid Generator";

type State = {
  method: "v1" | "v4";
  uuid: string;
  mode: "merge" | "plain";
};

class UuidGenerator extends ServiceBase<State> {
  f: () => string;
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      uuid: uuid.v4(),
      method: "v4",
      mode: "plain",
    });
    this.f = uuid.v4;
  }

  async configure(config: any) {
    if (needsUpdate(config.method, this.state.method)) {
      this.state.method = config.method;
      switch (config.method) {
        case "v1":
          this.f = uuid.v1;
          break;

        case "v4":
          this.f = uuid.v4;
          break;
      }
    }
    if (config.action === "generate") {
      this.app.next(this, this.process({}));
    }
    this.app.notify(this, { method: this.state.method });
  }

  process(params: any) {
    this.state.uuid = this.f();
    this.app.notify(this, { uuid: this.state.uuid });

    if (this.state.mode === "merge") {
      return { ...params, uuid: this.state.uuid };
    }
    return this.state.uuid;
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
  ) => new UuidGenerator(app, board, descriptor, id),
  createUI: UuidGeneratorUI,
};

export default descriptor;
