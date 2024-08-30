import { parseExpression, evalExpression } from "./eval";

const serviceId = "hookup.to/service/filter";
const serviceName = "Filter";

class Filter {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.aggregator = "and";
    this._parsedConditions = [];
    this.conditions = [];
  }

  parseConditions(conditions) {
    const arr = Array.isArray(conditions) ? conditions : [conditions];
    this._parsedConditions = arr.map((cond) => parseExpression(cond));
    return arr;
  }

  configure(config) {
    const { conditions, aggregator } = config;

    if (conditions !== undefined) {
      this.conditions = conditions;
      const arr = this.parseConditions(conditions);
      this.app.notify(this, { conditions: arr });
    }

    if (aggregator !== undefined) {
      this.aggregator = aggregator;
      this.app.notify(this, { aggregator });
    }
  }

  async process(params) {
    const filter = async (x) => {
      if (this._parsedConditions.length > 0 && x) {
        const results = await Promise.all(
          this._parsedConditions.map(async (pc) =>
            evalExpression(pc, { params: x })
          )
        );

        switch (this.aggregator) {
          case "and":
            return results.some((r) => !r) ? null : params;
          case "or":
            return results.some((r) => !!r) ? params : null;
          default:
            console.log(`Unknown filter aggregator: ${this.aggregator}`);
        }
      }
      return false;
    };

    if (Array.isArray(params)) {
      return Promise.all(params.filter(filter));
    }

    return filter(params);
  }
}

export default {
  serviceName,
  serviceId,
  service: Filter,
  Filter,
};
