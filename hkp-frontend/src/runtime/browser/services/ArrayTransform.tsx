import { AppImpl, ServiceClass } from "../../../types";
import ArrayTransformUI from "./ArrayTransformUI";

const serviceId = "hookup.to/service/array-transform";
const serviceName = "Array Transform";

class ArrayTransform {
  uuid: string;
  board: string;
  app: AppImpl;

  config = [];

  constructor(
    app: AppImpl,
    board: string,
    _descriptor: ServiceClass,
    id: string
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  async destroy() {}

  async configure(cfg: any) {
    const { config } = cfg || {};

    if (config !== undefined) {
      this.config = config;
      this.app.notify(this, { config });
    }
  }

  async process(params: any) {
    const data = processConfig(this.config, params);
    this.app.notify(this, { data });
    return data;
  }
}

function replaceParamsInString(params: any, src: string) {
  const keys = Object.keys(params);
  const replaced = keys.reduce(
    (acc, cur) => acc.split(`[[${cur}]]`).join(resolveValue(params, cur)),
    src
  );
  return replaced;
}

export function resolveValue(
  params: { [k: string]: any },
  address: string
): any {
  const parts = address.split(".");
  if (parts.length > 1) {
    const top = parts.shift();
    if (top === undefined) {
      throw new Error(`ArrayTransform.resolve, top is undefined: ${address}`);
    }
    const subparams = params[top];
    if (subparams === undefined) {
      throw new Error(
        `ArrayTransform.resolve, subparams is undefined: ${JSON.stringify(
          params
        )}, ${top}`
      );
    }
    return resolveValue(subparams, parts.join("."));
  }

  return params[address];
}

export function processConfig(cfg: any, params: any): string {
  if (Array.isArray(cfg)) {
    const children = cfg
      .map((c) => {
        const { select } = c;
        const selectedParam = select ? resolveValue(params, select) : params;
        return processConfig(c, selectedParam);
      })
      .join("");
    return replaceParamsInString(params, children);
  }

  const { html, children, select, filter } = cfg;
  return Array.isArray(params)
    ? params
        .filter((x) => {
          if (!filter) {
            return true;
          }
          try {
            return !!resolveValue(x, filter); // TODO: not a nice way of using exceptions
          } catch (err) {
            console.error("ArrayTransform.processConfig", err);
            return false;
          }
        })

        .map((param) => {
          const selectedParam = select ? resolveValue(param, select) : param;
          const childContent = children
            ? processConfig(children, selectedParam)
            : undefined;
          return replaceParamsInString(
            { ...param, children: childContent },
            html
          );
        })
        .join("")
    : replaceParamsInString(
        {
          ...params,
          children: children ? processConfig(children, params) : undefined,
        },
        html
      );
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new ArrayTransform(app, board, descriptor, id),
  createUI: ArrayTransformUI,
};

export default descriptor;
