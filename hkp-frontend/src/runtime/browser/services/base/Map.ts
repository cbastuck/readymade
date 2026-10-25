import { flatten } from "flat";
import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import { evalExpression } from "./eval";
import { Expression, parse } from "./expressionEval";

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
 *
 * What a pass says about itself is notified when it changes, and is part of
 * the state while there is something to say, so a panel opened later shows it;
 * configuring it does nothing. The same in every runtime (hkp-node map.ts,
 * hkp-python map_service.py, hkp-rt map.h):
 *
 * - `error`: a term that does not parse — said when the template is
 *   configured — or that fails to evaluate. A failing pass stops the flow
 *   (null), since a mapping that could not be made has nothing to pass on,
 *   and is logged, since nobody may be watching. With an array input, one
 *   failing element fails the pass.
 * - `warnings`: a term whose value is empty because what it read was not
 *   there — `title: params.titel not found`. The flow goes on: an absent field
 *   is often legitimate, and a typo is only visible this way.
 *
 * A lone "=" is the value of its term, whatever the mode; a null one has
 * nothing to pass on.
 */

const serviceId = "hookup.to/service/map";
const serviceName = "Map";

type State = {
  mode: "replace" | "add" | "overwrite";
  arrayMode: "array" | "single";
  template: any;
  sensingMode: boolean;
};

/** A `key=` term, compiled once when the template is set. */
type Term =
  | { ast: Expression }
  | { constant: unknown }
  | { parseError: string };

/** A term that failed, named by where it sits in the template. */
class TermError extends Error {}

type StructuredTemplateNode =
  | { type: "value"; value: any }
  | { type: "expression"; term: Term }
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
  _terms: { [key: string]: Term } = {};
  _properties: { [key: string]: any } = {};
  _structuredTemplate: StructuredTemplateNode | undefined = undefined;
  /** What was last notified about the template, so only a change is. */
  _reported = { error: "", warnings: [] as string[] };

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

    if (isStructuredTemplate(template)) {
      this.state.template = deepCopy(template);
      this._structuredTemplate = compileStructuredTemplate(template);
      this._terms = {};
      this._properties = {};
      this.app.notify(this, { template });
      this.report(firstParseError(this._structuredTemplate, ""), []);
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
          [cur.substring(0, cur.length - 1)]: compileTerm(value),
        };
      }
      return all;
    }, {});

    this.app.notify(this, { template });
    const broken = Object.entries(this._terms).find(
      ([, term]) => "parseError" in term,
    );
    this.report(
      broken
        ? `${pathIn("", broken[0])}: ${(broken[1] as { parseError: string }).parseError}`
        : "",
      [],
    );
  }

  /** Notifies what a pass or a template said about itself, when it changed. */
  report(error: string, warnings: string[]) {
    if (error !== this._reported.error) {
      this.app.notify(this, { error });
    }
    if (JSON.stringify(warnings) !== JSON.stringify(this._reported.warnings)) {
      this.app.notify(this, { warnings });
    }
    this._reported = { error, warnings };
  }

  getConfiguration = async () => ({
    ...this.state,
    bypass: this.bypass,
    ...(this._reported.error ? { error: this._reported.error } : {}),
    ...(this._reported.warnings.length
      ? { warnings: this._reported.warnings }
      : {}),
  });

  /**
   * One term's value. A failure is named by `label`, where the term sits in
   * the template; an empty value whose reads found nothing is a warning.
   */
  evaluateTerm = async (
    term: Term,
    params: any,
    warnings: Set<string>,
    label: string,
  ) => {
    if ("constant" in term) {
      return term.constant;
    }
    if ("parseError" in term) {
      throw new TermError(`${label}: ${term.parseError}`);
    }
    const missing: string[] = [];
    let value: unknown;
    try {
      value = await evalExpression(term.ast, { params }, this.app, this, (path) =>
        missing.push(path),
      );
    } catch (error: any) {
      throw new TermError(`${label}: ${error?.message ?? String(error)}`);
    }
    if ((value === undefined || value === null) && missing.length) {
      warnings.add(`${label}: ${missing.join(", ")} not found`);
    }
    return value;
  };

  updateSensingMode = (isActive: boolean) => {
    this.state.sensingMode = isActive;
    this.app.notify(this, { sensingMode: isActive });
  };

  mapper = async (x: any, warnings: Set<string>) => {
    if (this._structuredTemplate) {
      const mapped = await this.evalStructuredTemplateNode(
        this._structuredTemplate,
        x,
        warnings,
        "",
      );

      if (isLoneTerm(this._structuredTemplate)) {
        return mapped;
      }

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
      return keyed(
        await this.evaluateTerm(this._terms[""], x, warnings, pathIn("", "")),
      );
    }

    const initial =
      this.state.mode === "replace"
        ? deepCopy(this._properties)
        : this.state.mode === "overwrite"
          ? { ...x, ...deepCopy(this._properties) }
          : { ...deepCopy(this._properties), ...x };

    return await keys.reduce(async (acc, key) => {
      const accumulated = await acc;
      const y = keyed(
        await this.evaluateTerm(this._terms[key], x, warnings, pathIn("", key)),
      );
      return key.indexOf(".") !== -1 // dynamic expression
        ? {
            .../*this.state.mode === "replace"
              ? accumulated
              : */ merge(accumulated, y, key), // why shouldn't we merge in replace mode?
          }
        : {
            ...accumulated,
            // don't overwrite in add mode: a value the input has wins, even a
            // falsy one, as in the other runtimes
            [key]:
              this.state.mode === "add" && x?.[key] !== undefined ? x[key] : y,
          };
    }, Promise.resolve(initial));
  };

  process = async (params: any) => {
    if (this.state.sensingMode) {
      this.updateTemplate(sensed(flatten(params)));
      this.updateSensingMode(false);
      return null;
    }

    const perElement = this.state.arrayMode !== "single" && Array.isArray(params);
    if (!perElement && (!this._terms || !this._properties)) {
      if (this.state.mode === "replace") {
        return {};
      }
      return params;
    }

    const warnings = new Set<string>();
    try {
      const result = perElement
        ? await Promise.all(params.map((x: any) => this.mapper(x, warnings)))
        : await this.mapper(params, warnings);
      this.report("", [...warnings]);
      return result;
    } catch (error) {
      if (!(error instanceof TermError)) {
        throw error;
      }
      this.report(error.message, [...warnings]);
      this.app.log(this, "error", "service.failed", { message: error.message });
      return null;
    }
  };

  private evalStructuredTemplateNode = async (
    node: StructuredTemplateNode,
    params: any,
    warnings: Set<string>,
    label: string,
  ): Promise<any> => {
    if (node.type === "value") {
      return deepCopy(node.value);
    }

    if (node.type === "expression") {
      return await this.evaluateTerm(node.term, params, warnings, label);
    }

    if (node.type === "array") {
      const out: any[] = [];
      for (const [index, item] of node.items.entries()) {
        out.push(
          keyed(
            await this.evalStructuredTemplateNode(
              item,
              params,
              warnings,
              pathIn(label, String(index)),
            ),
          ),
        );
      }
      return out;
    }

    const entries = node.entries;
    if (isLoneTerm(node)) {
      return keyed(
        await this.evalStructuredTemplateNode(
          entries[0].node,
          params,
          warnings,
          pathIn(label, ""),
        ),
      );
    }

    const out: any = {};
    for (const entry of entries) {
      const value = keyed(
        await this.evalStructuredTemplateNode(
          entry.node,
          params,
          warnings,
          pathIn(label, entry.key),
        ),
      );
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
          ? { type: "expression" as const, term: compileTerm(value) }
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

/** Compiles a `key=` value: a string is an expression, anything else a constant. */
function compileTerm(source: unknown): Term {
  if (typeof source !== "string") {
    return { constant: source };
  }
  try {
    return { ast: parse(source) };
  } catch (error: any) {
    return {
      parseError: `invalid expression '${source}': ${error?.message ?? String(error)}`,
    };
  }
}

/**
 * A sensed template: the shape of what arrived, and nothing that runs — as in
 * the other runtimes. Sensing builds a template out of input, which arrives
 * from wherever the board is fed, and a key ending in "=" is an expression: a
 * field named `pwned=` would be compiled as code on the next pass. The suffix
 * is dropped rather than the field, so the field is still sensed.
 */
function sensed(flat: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    safe[key.replace(/=+$/, "")] = value;
  }
  return safe;
}

/** An object of a lone "=" key, which stands for its term's value. */
function isLoneTerm(node: StructuredTemplateNode): boolean {
  return (
    node.type === "object" &&
    node.entries.length === 1 &&
    node.entries[0].dynamic &&
    node.entries[0].key === ""
  );
}

/**
 * Where a term sits in a template: `items.0.title`. A lone "=" adds nothing to
 * the path, since it stands for the value it sits in; at the top it is named
 * "=". The one rule both configuring and a pass name a term by, so the same
 * failure is said in the same words.
 */
function pathIn(label: string, key: string): string {
  if (!key) {
    return label || "=";
  }
  return label ? `${label}.${key}` : key;
}

/**
 * A term's value under a key: a read that found nothing still produces the
 * key, as null, so the output has the same shape in every runtime.
 */
function keyed(value: unknown): unknown {
  return value === undefined ? null : value;
}

/** The first term in a structured template that does not parse, named. */
function firstParseError(node: StructuredTemplateNode, label: string): string {
  if (node.type === "expression") {
    return "parseError" in node.term
      ? `${label}: ${node.term.parseError}`
      : "";
  }
  if (node.type === "array") {
    for (const [index, item] of node.items.entries()) {
      const error = firstParseError(item, pathIn(label, String(index)));
      if (error) {
        return error;
      }
    }
  }
  if (node.type === "object") {
    for (const entry of node.entries) {
      const error = firstParseError(entry.node, pathIn(label, entry.key));
      if (error) {
        return error;
      }
    }
  }
  return "";
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
