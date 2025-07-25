import AggregatorUI from "./AggregatorUI";
import ServiceBase from "./ServiceBase";
import { AppInstance, ServiceClass } from "hkp-frontend/src/types";

const serviceId = "hookup.to/service/aggregator";
const serviceName = "Aggregator";

type State = {
  interval: number;
  property: string;
  aggregate: any;
};

class Aggregator extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      interval: 100,
      property: "unset",
      aggregate: {},
    });
  }
  __timer: any;

  configure(config: any) {
    const { interval, property } = config;

    if (interval !== undefined) {
      this.state.interval = interval;
      this.reset();
      this.app.notify(this, { interval });
    }

    if (property !== undefined) {
      this.state.property = property;
      this.app.notify(this, { property });
    }
  }

  destroy = () => {
    this.destroyTimer();
  };

  destroyTimer = () => {
    if (this.__timer) {
      clearInterval(this.__timer);
    }
  };

  reset = () => {
    this.destroyTimer();
    this.__timer = setInterval(this.doSubmit, this.state.interval);
  };

  doAggregate = (params: any) => {
    for (const key of Object.keys(params)) {
      const value = params[key];
      if (value === null) {
        return;
      }
      if (!this.state.aggregate[key]) {
        this.state.aggregate[key] = { [value]: 1 };
      } else {
        const aggValues = this.state.aggregate[key];
        if (aggValues[value] !== undefined) {
          ++aggValues[value];
        } else {
          aggValues[value] = 1;
        }
      }
    }
  };

  doSubmit = () => {
    const aggregate = this.state.aggregate[this.state.property];
    if (aggregate) {
      const keys = Object.keys(aggregate);
      const firstKey = keys[0];
      if (firstKey) {
        const winner = keys.reduce(
          (max, curKey) => {
            const curValue = aggregate[curKey];
            return max.value < curValue
              ? { key: curKey, value: curValue }
              : max;
          },
          {
            key: firstKey,
            value: this.state.aggregate[this.state.property][firstKey],
          }
        );
        const nextParams = {
          [this.state.property]: winner.key,
        };
        this.app.next(this, nextParams);
      }
    }
    this.state.aggregate = {};
  };

  async process(params: any) {
    if (Array.isArray(params)) {
      params.forEach(this.doAggregate);
    } else {
      this.doAggregate(params);
    }
    return null;
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
  ) => new Aggregator(app, board, descriptor, id),
  createUI: AggregatorUI,
};

export default descriptor;
