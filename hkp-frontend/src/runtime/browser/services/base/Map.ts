import { flatten } from "flat";
import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import { parseExpression, evalExpression } from "./eval";

import ServiceBase from "hkp-frontend/src/runtime/browser/services/ServiceBase";

/**
 * Service Documentation
 * Service ID: hookup.to/service/map
 * Service Name: Map
 * Modes: replace | add | overwrite | sensingMode
 * Key Config: template, mode, sensingMode
 * Input: object | array | scalar
 * Output: mapped object/scalar; null when sensingMode captures template
 * Arrays: maps each array element
 * Binary: not intended for raw binary payloads
 * MixedData: not native in browser runtime
 */

const serviceId = "hookup.to/service/map";
const serviceName = "Map";

type State = {
  mode: "replace" | "add" | "overwrite";
  template: { [key: string]: any };
  sensingMode: boolean;
};

class Map extends ServiceBase<State> {
  _terms: { [key: string]: any } = {};
  _properties: { [key: string]: any } = {};

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      mode: "replace",
      template: {},
      sensingMode: false,
    });
  }

  async configure(config: any) {
    const { template, mode, sensingMode } = config;
    if (template !== undefined) {
      this.updateTemplate(template);
    }

    if (mode !== undefined) {
      this.state.mode = mode;
      this.app.notify(this, { mode });
    }

    if (sensingMode !== undefined) {
      this.updateSensingMode(sensingMode);
    }

    if (config.command) {
      if (config.command.action === "inject") {
        const data = await this.process(config.command.params);
        this.app.next(this, data);
      }
    }
  }

  updateTemplate(template: any) {
    this.state.template = flatten(template); // store as flat object for persistence

    this._properties = Object.keys(template).reduce((all, cur) => {
      const value = template[cur];
      if (cur[cur.length - 1] !== "=") {
        return cur.indexOf(".") !== -1
          ? { ...merge(all, value, cur) }
          : { ...all, [cur]: value };
      }
      return all;
    }, {});

    this._terms = Object.keys(template).reduce((all, cur) => {
      const value = template[cur];
      if (cur[cur.length - 1] === "=") {
        // treated as a dynamic term not a static property
        return {
          ...all,
          [cur.substring(0, cur.length - 1)]: parseExpression(value),
        };
      }
      return all;
    }, {});

    this.app.notify(this, { template });
  }

  updateSensingMode = (isActive: boolean) => {
    this.state.sensingMode = isActive;
    this.app.notify(this, { sensingMode: isActive });
  };

  mapper = async (x: any) => {
    try {
      const keys = this._terms ? Object.keys(this._terms) : [];
      // map to scalar value (not an object) if only an '=', i.e. empty string
      if (keys.length === 1 && keys[0] === "") {
        const expression = this._terms[keys[0]];
        return await evalExpression(expression, { params: x }, this.app);
      }

      const initial =
        this.state.mode === "replace"
          ? deepCopy(this._properties)
          : this.state.mode === "overwrite"
            ? { ...x, ...deepCopy(this._properties) }
            : { ...deepCopy(this._properties), ...x };

      return await keys.reduce(async (acc, key) => {
        const expression = this._terms[key];
        if (!expression) {
          return acc;
        }

        const accumulated = await acc;
        const y = await evalExpression(expression, { params: x }, this.app);
        return key.indexOf(".") !== -1 // dynamic expression
          ? {
              .../*this.state.mode === "replace"
                ? accumulated
                : */ merge(accumulated, y, key), // why shouldn't we merge in replace mode?
            }
          : {
              ...accumulated,
              [key]: x[key] && this.state.mode === "add" ? x[key] : y, // don't overwrite in add mode
            };
      }, Promise.resolve(initial));
    } catch (error) {
      console.error(
        "Error in Map.process",
        error,
        "in template",
        JSON.stringify(this.state.template || "<empty>"),
      );
      return x; // do not map the input - there was an error - return identity
    }
  };

  process = async (params: any) => {
    if (this.state.sensingMode) {
      this.updateTemplate(flatten(params));
      this.updateSensingMode(false);
      return null;
    }

    //TODO: who needs this??? - new concept for handling arrays ...
    // probably generic
    if (Array.isArray(params)) {
      return await Promise.all(params.map(this.mapper));
    }

    if (!this._terms || !this._properties) {
      if (this.state.mode === "replace") {
        return {};
      }
      return params;
    }

    return this.mapper(params);
  };
}

function deepCopy(x: any) {
  return JSON.parse(JSON.stringify(x));
}

function merge(dst: any, value: any, path: string) {
  path.split(".").reduce((branch, key, idx, src) => {
    const isLastKey = idx + 1 >= src.length;
    if (branch[key] !== undefined) {
      return branch[key];
    }
    return (branch[key] = isLastKey ? value : {});
  }, dst);
  return dst;
}

export default {
  serviceName,
  serviceId,
  service: Map,
  Map,
};
