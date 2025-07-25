import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";

import ServiceBase from "hkp-frontend/src/runtime/browser/services/ServiceBase";

const serviceId = "hookup.to/service/group-by";
const serviceName = "GroupBy";

type State = {
  property: string;
  mode: "histogram" | "sum";
};

class GroupBy extends ServiceBase<State> {
  _terms: { [key: string]: any } = {};
  _properties: { [key: string]: any } = {};

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, { property: "", mode: "histogram" });
  }

  configure(config: any) {
    const { property, mode } = config;
    if (needsUpdate(property, this.state.property)) {
      this.state.property = property;
      this.app.notify(this, { property });
    }

    if (needsUpdate(mode, this.state.mode)) {
      this.state.mode = mode;
      this.app.notify(this, { mode });
    }
  }

  processSum = (params: any) => {
    const { property } = this.state;
    if (Array.isArray(params)) {
      return params.reduce((sum, item) => {
        const val = item[property] ?? 0;
        return sum + val;
      }, 0);
    }
    console.warn(
      `GroupBy service mode histogram only works with array: ${JSON.stringify(
        params
      )}`
    );
    return null;
  };

  processHistogram = (params: any) => {
    if (Array.isArray(params)) {
      const result = params.reduce((acc, cur) => {
        const val = cur[this.state.property];
        if (acc[val] === undefined) {
          return { ...acc, [val]: 1 };
        }
        return { ...acc, [val]: acc[val] + 1 };
      }, {});

      const addValues = true;
      if (addValues) {
        return Object.keys(result).reduce(
          (acc, cur) => ({ ...acc, [`${cur}`]: result[cur] }),
          {}
        );
      }
      return result;
    }
    console.warn(
      `GroupBy service mode histogram only works with array: ${JSON.stringify(
        params
      )}`
    );
    return null;
  };

  process = async (params: any) => {
    switch (this.state.mode) {
      case "histogram":
        return this.processHistogram(params);
      case "sum":
        return this.processSum(params);
      default:
        break;
        return null;
    }
  };
}

export default {
  serviceName,
  serviceId,
  service: GroupBy,
  GroupBy,
};
