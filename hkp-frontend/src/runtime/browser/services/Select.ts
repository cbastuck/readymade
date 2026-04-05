import { AppInstance, ServiceClass } from "../../../types";

/**
 * Service Documentation
 * Service ID: hookup.to/service/select
 * Service Name: Select
 * Modes: array-index selection
 * Key Config: arrayIndex
 * Input: array preferred
 * Output: selected array element or identity fallback
 * Arrays: primary behavior
 * Binary: not intended
 * MixedData: not native in browser runtime
 */

const serviceId = "hookup.to/service/select";
const serviceName = "Select";

class Select {
  uuid: string;
  board: string;
  app: AppInstance;
  arrayIndex: number | undefined;

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string,
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.arrayIndex = undefined;
  }

  configure(config: { arrayIndex?: number }): void {
    const { arrayIndex } = config;
    if (arrayIndex !== undefined) {
      this.arrayIndex = arrayIndex;
    }
  }

  process(params: any): any {
    if (Array.isArray(params) && this.arrayIndex !== undefined) {
      return params[this.arrayIndex];
    }
    console.warn("Unsupported input type, can't select");
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppInstance, board: string, desc: ServiceClass, id: string) =>
    new Select(app, board, desc, id),
  createUI: undefined,
};

export default descriptor;
