import { AppInstance, ServiceClass } from "../../../types";

const serviceId = "hookup.to/service/state";
const serviceName = "State";

interface MacroTemplate {
  [key: string]: any;
}

interface Macro {
  variables: string[];
  template: MacroTemplate | MacroTemplate[];
}

interface MacroMap {
  [name: string]: Macro;
}

class State {
  uuid: string;
  board: string;
  app: AppInstance;
  state: Record<string, any>;
  macros: MacroMap | undefined;

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.state = {};
  }

  configure(config: { macros?: MacroMap } | null): void {
    const { macros } = config || {};
    if (macros) {
      this.macros = Object.keys(macros).reduce<MacroMap>(
        (all, macro) => ({ ...all, [macro]: macros[macro] }),
        {}
      );
    }
  }

  replaceMacroVariables(
    variables: string[],
    item: Record<string, any>,
    template: MacroTemplate,
    key: string
  ): any {
    const regex = /\$value/gi;
    const templateValue = template[key];
    if (variables.indexOf(key) === -1) {
      return templateValue;
    }

    if (!regex.test(templateValue)) {
      return templateValue;
    }

    const replacement = item[key];
    return replacement ? templateValue.replace(regex, replacement) : undefined;
  }

  processMacros(input: any[]): any[] {
    return input
      .map((item) => {
        const type = item.type || "";
        if (item.type && type.startsWith("macro:")) {
          const name = type.split("macro:")[1];
          const macro = this.macros && this.macros[name];
          if (!macro) {
            console.error(
              `Could not find macro with name: ${name} in macros: ${JSON.stringify(
                this.macros
              )}`
            );
            return undefined;
          }
          // set item to macro and replace variables
          const templates = Array.isArray(macro.template)
            ? macro.template
            : [macro.template];
          return templates.map((template) =>
            Object.keys(template).reduce((obj: Record<string, any>, key) => {
              const value = this.replaceMacroVariables(
                macro.variables,
                item,
                template,
                key
              );
              return value !== undefined ? { ...obj, [key]: value } : obj;
            }, {})
          );
        }
        return item;
      })
      .flat();
  }

  process(objectOrArray: any): any {
    if (!objectOrArray) {
      return undefined;
    }

    if (!Array.isArray(objectOrArray)) {
      return this.process([objectOrArray]);
    }

    const preProcessed = this.processMacros(objectOrArray);
    return preProcessed.map((item) => {
      const id = item && item.id;
      const ref = item && item.ref;
      if (!id && !ref) {
        return item;
      }

      if (id) {
        this.state[id] = item;
        return item;
      }

      // item references the internal state
      const state = this.state[ref];
      if (!state) {
        console.error(`Referenced state does not exist: ${ref}`);
        return item;
      }

      return Object.keys(item).reduce(
        (all: Record<string, any>, key) => ({ ...all, [key]: item[key] }),
        state
      );
    });
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppInstance, board: string, desc: ServiceClass, id: string) =>
    new State(app, board, desc, id),
};

export default descriptor;
