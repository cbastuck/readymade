import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";

import AnalyzerUI from "./AnalyzerUI";

const serviceId = "hookup.to/service/analyzer";
const serviceName = "Analyzer";

type State = unknown;

class Analyzer extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {});
  }

  async configure(config: any) {
    return config;
  }

  async process(params: any) {
    this.app.notify(this, { onProcess: params });
    return params;
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
  ) => new Analyzer(app, board, descriptor, id),
  createUI: AnalyzerUI,
};

export default descriptor;
