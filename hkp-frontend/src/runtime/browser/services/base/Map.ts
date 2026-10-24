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
  arrayMode: "array" | "single";
  template: any;
  sensingMode: boolean;
};

type StructuredTemplateNode =
  | { type: "value"; value: any }
  | { type: "expression"; expression: any }
  | { type: "array"; items: StructuredTemplateNode[] }
  | {
      type: "object";
      entries: Array<{
        key: string;
        dynamic: boolean;
        node: StructuredTemplateNode;
      }>;
    };

class Map extends ServiceBase<State> {
  _terms: { [key: string]: any } = {};
  _properties: { [key: string]: any } = {};
  _structuredTemplate: StructuredTemplateNode | undefined = undefined;
  // Why the last mapping failed, or null when it did not. Reported, never
  // saved: it says how the board is running, not how it is configured.
  _error: string | null = null;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      mode: "replace",
      arrayMode: "array",
      template: {},
      sensingMode: false,
    });
  }

  async configure(config: any) {
    const { template, mode, arrayMode, sensingMode } = config;
    if (template !== undefined) {
      this.updateTemplate(template);
    }

    if (mode !== undefined) {
      this.state.mode = mode;
      this.app.notify(this, { mode });
    }

    if (arrayMode !== undefined) {
      this.state.arrayMode = arrayMode;
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
    this._structuredTemplate = undefined;
    // An error was about the template it replaces; the next run tells about
    // this one.
    this.reportError(null);

    if (isStructuredTemplate(template)) {
      this.state.template = deepCopy(template);
      this._structuredTemplate = compileStructuredTemplate(template);
      this._terms = {};
      this._properties = {};
      this.app.notify(this, { template });
      return;
    }

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

  // Sent when it changes, not on every run: a Map behind a fast timer would
  // otherwise repeat the same message many times a second.
  reportError(error: string | null) {
    if (error === this._error) {
      return;
    }
    this._error = error;
    this.app.notify(this, { error });
  }

  // A failing term is named by its key, since the panel shows one message for
  // the whole template.
  evalTerm = async (key: string, expression: any, params: any) => {
    try {
      return await evalExpression(expression, { params }, this.app, this);
    } catch (err: any) {
      const message = err?.message ?? String(err);
      throw new Error(key ? `${key}: ${message}` : message);
    }
  };

  mapper = async (x: any, failures?: string[]) => {
    try {
      if (this._structuredTemplate) {
        const mapped = await this.evalStructuredTemplateNode(
          this._structuredTemplate,
          x,
        );

        const canMergeObjects =
          mapped !== null &&
          typeof mapped === "object" &&
          !Array.isArray(mapped) &&
          x !== null &&
          typeof x === "object" &&
          !Array.isArray(x);

        if (!canMergeObjects || this.state.mode === "replace") {
          return mapped;
        }

        if (this.state.mode === "overwrite") {
          return { ...x, ...mapped };
        }

        return { ...mapped, ...x };
      }

      const keys = this._terms ? Object.keys(this._terms) : [];
      // map to scalar value (not an object) if only an '=', i.e. empty string
      if (keys.length === 1 && keys[0] === "") {
        return await this.evalTerm("", this._terms[keys[0]], x);
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
        const y = await this.evalTerm(key, expression, x);
        return key.indexOf(".") !== -1 // dynamic expression
          ? {
              .../*this.state.mode === "replace"
                ? accumulated
                : */ merge(accumulated, y, key), // why shouldn't we merge in replace mode?
            }
          : {
              ...accumulated,
              [key]: x?.[key] && this.state.mode === "add" ? x[key] : y, // don't overwrite in add mode
            };
      }, Promise.resolve(initial));
    } catch (error) {
      console.error(
        "Error in Map.process",
        error,
        "in template",
        JSON.stringify(this.state.template || "<empty>"),
      );
      failures?.push(error instanceof Error ? error.message : String(error));
      return x; // do not map the input - there was an error - return identity
    }
  };

  process = async (params: any) => {
    if (this.state.sensingMode) {
      this.updateTemplate(flatten(params));
      this.updateSensingMode(false);
      return null;
    }

    const failures: string[] = [];
    const mapOne = (x: any) => this.mapper(x, failures);

    if (this.state.arrayMode !== "single" && Array.isArray(params)) {
      const results = await Promise.all(params.map(mapOne));
      this.reportError(failures[0] ?? null);
      return results;
    }

    if (!this._terms || !this._properties) {
      if (this.state.mode === "replace") {
        return {};
      }
      return params;
    }

    const result = await mapOne(params);
    this.reportError(failures[0] ?? null);

    return result;
  };

  private evalStructuredTemplateNode = async (
    node: StructuredTemplateNode,
    params: any,
  ): Promise<any> => {
    if (node.type === "value") {
      return deepCopy(node.value);
    }

    if (node.type === "expression") {
      return await evalExpression(node.expression, { params }, this.app, this);
    }

    if (node.type === "array") {
      const out: any[] = [];
      for (const item of node.items) {
        out.push(await this.evalStructuredTemplateNode(item, params));
      }
      return out;
    }

    const entries = node.entries;
    if (
      entries.length === 1 &&
      entries[0].dynamic &&
      entries[0].key === "" &&
      entries[0].node.type === "expression"
    ) {
      return await this.evalTerm("", entries[0].node.expression, params);
    }

    const out: any = {};
    for (const entry of entries) {
      const value =
        entry.node.type === "expression"
          ? await this.evalTerm(entry.key, entry.node.expression, params)
          : await this.evalStructuredTemplateNode(entry.node, params);
      if (entry.key.indexOf(".") !== -1) {
        merge(out, value, entry.key);
      } else {
        out[entry.key] = value;
      }
    }
    return out;
  };
}

function isStructuredTemplate(template: any) {
  return Array.isArray(template) || hasNestedStructure(template);
}

function hasNestedStructure(template: any): boolean {
  if (
    template === null ||
    typeof template !== "object" ||
    Array.isArray(template)
  ) {
    return false;
  }

  return Object.values(template).some(
    (value) => value !== null && typeof value === "object",
  );
}

function compileStructuredTemplate(template: any): StructuredTemplateNode {
  if (Array.isArray(template)) {
    return {
      type: "array",
      items: template.map((item) => compileStructuredTemplate(item)),
    };
  }

  if (template !== null && typeof template === "object") {
    const entries = Object.keys(template).map((key) => {
      const value = template[key];
      const dynamic = key.endsWith("=");
      return {
        key: dynamic ? key.slice(0, -1) : key,
        dynamic,
        node: dynamic
          ? { type: "expression" as const, expression: parseExpression(value) }
          : compileStructuredTemplate(value),
      };
    });

    return {
      type: "object",
      entries,
    };
  }

  return {
    type: "value",
    value: template,
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
