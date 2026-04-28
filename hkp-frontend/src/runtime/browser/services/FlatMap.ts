import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import FlatMapUI from "./FlatMapUI";
import {
  parseExpression,
  evalExpression,
  Expression,
  SyntaxError,
} from "./base/eval";

/**
 * Service Documentation
 * Service ID: hookup.to/service/flat-map
 * Service Name: FlatMap
 * Input:  any value or array of values
 * Output: flat array — expression is evaluated per input item and results are
 *         concatenated; null/undefined results are dropped
 * Config: expression — evaluated with params = current item, must return an array
 *
 * Example: expression "params.tags" on [{tags:["a","b"]},{tags:["c"]}] → ["a","b","c"]
 */

const serviceId = "hookup.to/service/flat-map";
const serviceName = "FlatMap";

type State = { expression: string };

class FlatMap extends ServiceBase<State> {
  private _parsed: Expression | SyntaxError | undefined;

  constructor(app: AppInstance, board: string, descriptor: ServiceClass, id: string) {
    super(app, board, descriptor, id, { expression: "" });
  }

  configure(config: any) {
    if (config?.expression !== undefined) {
      this.state.expression = config.expression;
      this._parsed = parseExpression(config.expression);
      this.app.notify(this, { expression: this.state.expression });
    }
    return this.state;
  }

  async process(params: any): Promise<any> {
    if (!this._parsed || !this.state.expression) {
      return params;
    }

    const items = Array.isArray(params) ? params : [params];
    const results = await Promise.all(
      items.map((item) => evalExpression(this._parsed!, { params: item }, this.app)),
    );

    return results
      .flatMap((r) => (Array.isArray(r) ? r : r != null ? [r] : []))
      .filter((x) => x != null);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppInstance, board: string, descriptor: ServiceClass, id: string) =>
    new FlatMap(app, board, descriptor, id),
  createUI: FlatMapUI,
};

export default descriptor;
